#!/usr/bin/env node
/**
 * postinstall — one-time GitHub-star prompt during `npm install -g @bitkyc08/opencodex`.
 *
 * Behavior:
 *   - TTY-only (skips CI / piped installs)
 *   - Requires `gh` CLI with auth (stars directly via `gh api`)
 *   - Prompts once; shares the ~/.opencodex/.star-prompted marker with the first-`ocx start` prompt
 *     (so bun users — where postinstall may not run on `-g` — still get it exactly once on start)
 *   - Never blocks the install (all errors silently caught)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { homedir } from "node:os";

const REPO = "lidge-jun/opencodex";
const MARKER = join(homedir(), ".opencodex", ".star-prompted");

function ghInstalled() {
  const r = spawnSync("gh", ["--version"], { stdio: "ignore", timeout: 3000, windowsHide: true });
  return !r.error && r.status === 0;
}

function starRepo() {
  const r = spawnSync("gh", ["api", "-X", "PUT", `/user/starred/${REPO}`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10000, windowsHide: true });
  if (r.error) return { ok: false, error: r.error.message };
  if (r.status !== 0) return { ok: false, error: (r.stderr || r.stdout || "").trim() || `gh exited ${r.status}` };
  return { ok: true };
}

async function askYesNo(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const a = (await rl.question(question)).trim().toLowerCase();
    return a === "" || a === "y" || a === "yes";
  } finally {
    rl.close();
  }
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return;
  if (existsSync(MARKER)) return;
  if (!ghInstalled()) return;

  try { mkdirSync(join(homedir(), ".opencodex"), { recursive: true }); writeFileSync(MARKER, new Date().toISOString()); } catch { /* best-effort */ }

  const yes = await askYesNo("[opencodex] Enjoying opencodex? Star it on GitHub? [Y/n] ");
  if (!yes) return;
  const r = starRepo();
  console.log(r.ok ? "[opencodex] Thanks for the star! ⭐" : `[opencodex] Couldn't star automatically: ${r.error}`);
}

main().catch(() => { /* never fail the install */ });
