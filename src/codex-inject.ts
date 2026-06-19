import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { atomicWriteFile } from "./config";
import { restoreCodexCatalog } from "./codex-catalog";
import { CODEX_CONFIG_PATH, CODEX_PROFILE_PATH, DEFAULT_CATALOG_PATH, parseTomlString, readRootTomlString, tomlString } from "./codex-paths";
import type { OcxConfig } from "./types";

const OCX_SECTION_MARKER = "# Auto-injected by opencodex";

/**
 * The `[model_providers.opencodex]` TABLE only. A table is position-independent in TOML, so it is
 * safe to append at EOF. The bare root key `model_provider = "opencodex"` is NOT included here —
 * it must live at the document root (before any table header) and is set separately by
 * setRootModelProvider(). Appending the bare key at EOF was the original bug: it nested under
 * whatever `[table]` happened to be open last (e.g. `[plugins."chrome@openai-bundled"]`), so Codex
 * never saw a global model_provider and silently fell back to the `openai` (ChatGPT) provider.
 */
function buildProviderTableBlock(port: number): string {
  const lines = [
    "",
    OCX_SECTION_MARKER,
    "[model_providers.opencodex]",
    'name = "OpenCodex Proxy"',
    `base_url = "http://localhost:${port}/v1"`,
    'wire_api = "responses"',
  ];
  return lines.join("\n") + "\n";
}

function buildProfileTableBlock(catalogPath: string): string {
  return [
    "",
    "[profiles.opencodex]",
    'model_provider = "opencodex"',
    `model_catalog_json = ${tomlString(catalogPath)}`,
  ].join("\n") + "\n";
}

/**
 * Strip every existing `model_provider` line that we must not duplicate: any line set to
 * "opencodex" (wherever it sits — including a previously mis-nested one under a table), plus any
 * ROOT-level model_provider (before the first table) of any value, since we override the global.
 * A `model_provider` legitimately inside a user table/profile with a non-opencodex value is left
 * untouched.
 */
function stripExistingModelProvider(content: string): string {
  const lines = content.split("\n");
  const firstTable = lines.findIndex(l => /^\s*\[/.test(l));
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (/^\s*model_provider\s*=/.test(line)) {
      const isOurs = /^\s*model_provider\s*=\s*"opencodex"\s*$/.test(line);
      const isRoot = firstTable === -1 || i < firstTable;
      if (isOurs || isRoot) return; // drop it
    }
    out.push(line);
  });
  return out.join("\n");
}

/**
 * Insert `model_provider = "opencodex"` at the document ROOT — immediately before the first table
 * header (TOML root keys must precede all tables). If there are no tables, append it to the root body.
 */
function setRootModelProvider(content: string): string {
  const lines = content.split("\n");
  const firstTable = lines.findIndex(l => /^\s*\[/.test(l));
  const key = 'model_provider = "opencodex"';
  if (firstTable === -1) {
    return content.replace(/\n+$/, "") + "\n" + key + "\n";
  }
  let insertAt = firstTable;
  while (insertAt > 0 && lines[insertAt - 1].trim() === "") insertAt--;
  lines.splice(insertAt, 0, key);
  return lines.join("\n");
}

function readRootModelCatalogPath(content: string): string | null {
  return readRootTomlString(content, "model_catalog_json");
}

function setRootModelCatalogPath(content: string, catalogPath: string): string {
  if (readRootModelCatalogPath(content)) return content;
  const lines = content.split("\n");
  const firstTable = lines.findIndex(l => /^\s*\[/.test(l));
  const key = `model_catalog_json = ${tomlString(catalogPath)}`;
  if (firstTable === -1) {
    return content.replace(/\n+$/, "") + "\n" + key + "\n";
  }
  let insertAt = firstTable;
  while (insertAt > 0 && lines[insertAt - 1].trim() === "") insertAt--;
  lines.splice(insertAt, 0, key);
  return lines.join("\n");
}

function removeProfileSection(content: string): string {
  const lines = content.split("\n");
  const filtered: string[] = [];
  let inProfile = false;
  for (const line of lines) {
    if (line.trim() === "[profiles.opencodex]") {
      inProfile = true;
      continue;
    }
    if (inProfile) {
      if (line.startsWith("[") && line.trim() !== "[profiles.opencodex]") {
        inProfile = false;
        filtered.push(line);
      }
      continue;
    }
    filtered.push(line);
  }
  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function normalizeServiceTier(content: string): string {
  return content.replace(/^(\s*service_tier\s*=\s*)["']priority["']\s*$/gm, '$1"fast"');
}

function stripDefaultCatalogPath(content: string): string {
  return content
    .split("\n")
    .filter(line => {
      const m = line.match(/^\s*model_catalog_json\s*=\s*("(?:\\.|[^"])*"|'[^']*')\s*$/);
      return !m || parseTomlString(m[1]) !== DEFAULT_CATALOG_PATH;
    })
    .join("\n");
}

function buildProfileFile(port: number, catalogPath: string): string {
  return [
    "# OpenCodex proxy profile — use with: codex --profile opencodex",
    `# Routes all model requests through the opencodex proxy at localhost:${port}`,
    'model_provider = "opencodex"',
    `model_catalog_json = ${tomlString(catalogPath)}`,
    "",
  ].join("\n");
}

export async function injectCodexConfig(port: number, _config?: OcxConfig): Promise<{ success: boolean; message: string }> {
  if (!existsSync(CODEX_CONFIG_PATH)) {
    return { success: false, message: `Codex config not found at ${CODEX_CONFIG_PATH}. Is Codex installed?` };
  }

  let content = readFileSync(CODEX_CONFIG_PATH, "utf-8");

  // Idempotent clean-up of any prior injection: drop the provider table (marker-based) and every
  // stray/mis-nested model_provider line, so re-injecting can't duplicate keys or leave the buggy
  // table-nested key behind.
  if (content.includes("[model_providers.opencodex]")) {
    content = removeOcxSection(content);
  }
  content = removeProfileSection(content);
  content = stripExistingModelProvider(content);
  content = normalizeServiceTier(content);

  const catalogPath = readRootModelCatalogPath(content) ?? DEFAULT_CATALOG_PATH;
  content = setRootModelCatalogPath(content, catalogPath);

  // 1) Root key BEFORE the first table header (must be a global, not nested under a table).
  content = setRootModelProvider(content);
  // 2) Provider table appended at EOF (position-independent).
  content = content.trimEnd() + "\n" + buildProviderTableBlock(port);
  content = content.trimEnd() + "\n" + buildProfileTableBlock(catalogPath);

  writeFileSync(CODEX_CONFIG_PATH, content, "utf-8");
  writeFileSync(CODEX_PROFILE_PATH, buildProfileFile(port, catalogPath), "utf-8");

  return {
    success: true,
    message: `Injected opencodex as default provider into Codex config.\n` +
      `  All models now route through opencodex proxy (like OpenRouter).\n` +
      `  OpenAI models (gpt-5.5, etc.) are passed through to OpenAI.\n` +
      `  Custom models route to their configured providers.\n` +
      `  Fallback: codex --profile opencodex (same behavior)`,
  };
}

function removeOcxSection(content: string): string {
  const lines = content.split("\n");
  const filtered: string[] = [];
  let inOcxSection = false;
  for (const line of lines) {
    if (line.includes(OCX_SECTION_MARKER) || line.trim() === "[model_providers.opencodex]") {
      inOcxSection = true;
      continue;
    }
    if (inOcxSection) {
      // End the injected section at the next table header that ISN'T our own — exact match so a
      // user's "[model_providers.opencodex_backup]" (or similar) is preserved, not swallowed.
      if (line.startsWith("[") && line.trim() !== "[model_providers.opencodex]") {
        inOcxSection = false;
        filtered.push(line);
      }
      continue;
    }
    filtered.push(line);
  }
  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Pure transform: strip the opencodex provider block + `model_provider = "opencodex"` lines. */
export function stripOpencodexConfig(content: string): string {
  let out = content;
  if (out.includes("[model_providers.opencodex]")) {
    out = removeOcxSection(out);
  }
  out = removeProfileSection(out);
  // Regex (not exact-string) removal so compact `model_provider="opencodex"` is stripped too —
  // must match the detection regex above, or a detected line could survive un-removed.
  out = out.split("\n").filter(l => !/^\s*model_provider\s*=\s*"opencodex"\s*$/.test(l)).join("\n");
  out = stripDefaultCatalogPath(out);
  return out.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function hasOpencodexRouting(content: string): boolean {
  return content.includes("[model_providers.opencodex]") || /^\s*model_provider\s*=\s*"opencodex"/m.test(content);
}

export function removeCodexConfig(): { success: boolean; message: string } {
  if (!existsSync(CODEX_CONFIG_PATH)) {
    return { success: false, message: "Codex config not found." };
  }
  const content = readFileSync(CODEX_CONFIG_PATH, "utf-8");
  const had = hasOpencodexRouting(content);
  if (had) {
    atomicWriteFile(CODEX_CONFIG_PATH, stripOpencodexConfig(content));
  }
  if (existsSync(CODEX_PROFILE_PATH)) unlinkSync(CODEX_PROFILE_PATH);
  return {
    success: true,
    message: had ? "Removed opencodex routing from Codex config + profile." : "opencodex not present in Codex config.",
  };
}

/**
 * Recover native Codex: strip opencodex from config.toml AND drop proxy-routed catalog entries,
 * so plain `codex` works when the proxy is stopped. Called by `ocx stop`, the proxy shutdown
 * handler, and `ocx restore`. Idempotent + atomic.
 */
export function restoreNativeCodex(): { success: boolean; message: string } {
  const cfg = removeCodexConfig();
  const cat = restoreCodexCatalog();
  const msg = cat.removed > 0
    ? `${cfg.message} Catalog restored to ${cat.kept} native model(s) (dropped ${cat.removed} proxy-routed).`
    : cfg.message;
  return { success: cfg.success, message: msg };
}

export function getCodexConfigPath(): string {
  return CODEX_CONFIG_PATH;
}
