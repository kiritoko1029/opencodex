#!/usr/bin/env bun
import { restoreNativeCodex } from "./codex-inject";
import { loadConfig, readPid, removePid, writePid } from "./config";
import { serviceCommand } from "./service";
import { startServer } from "./server";
import { maybeShowStarPrompt } from "./star-prompt";

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`opencodex (ocx) — Universal provider proxy for Codex

Usage:
  ocx init                    Interactive setup (provider + Codex config injection)
  ocx start [--port <port>]   Start the proxy server (auto-syncs models to Codex)
  ocx stop                    Stop the proxy AND restore native Codex (plain codex works again)
  ocx restore                 Restore native Codex without stopping (alias: eject)
  ocx service <sub>           Run as a background service (install|start|stop|status|uninstall)
  ocx sync                    Fetch models from providers and inject into Codex config
  ocx status                  Check proxy server status
  ocx login <provider>        OAuth login (xai) — opens browser, stores token in ~/.opencodex/auth.json
  ocx logout <provider>       Remove a stored OAuth login
  ocx update                  Update opencodex to the latest published version
  ocx help                    Show this help message

Examples:
  ocx init                    Set up provider and inject into Codex
  ocx start                   Start on default port (10100)
  ocx start --port 8080       Start on custom port
  ocx sync                    Sync available models to Codex`);
}

async function syncModelsToCodex(port?: number) {
  const config = loadConfig();
  const p = port ?? config.port ?? 10100;
  const { injectCodexConfig } = await import("./codex-inject");
  const result = await injectCodexConfig(p, config);
  try {
    const { invalidateCodexModelsCache, syncCatalogModels } = await import("./codex-catalog");
    const cat = await syncCatalogModels(config);
    if (cat.added > 0) {
      invalidateCodexModelsCache();
      console.log(`   + ${cat.added} models appended to Codex catalog (${cat.path})`);
    }
  } catch (e) {
    console.error("catalog sync skipped:", e instanceof Error ? e.message : String(e));
  }
  console.log(result.message);
  return result;
}

function handleStart() {
  const existingPid = readPid();
  if (existingPid) {
    console.error(`⚠️  Proxy already running (PID ${existingPid}). Use 'ocx stop' first.`);
    process.exit(1);
  }

  let port: number | undefined;
  const portIdx = args.indexOf("--port");
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1], 10);
    if (isNaN(port)) {
      console.error("Invalid port number");
      process.exit(1);
    }
  }

  const server = startServer(port);
  writePid(process.pid);

  void maybeShowStarPrompt(); // once-only [Y/n] GitHub-star prompt on first interactive start
  syncModelsToCodex(port).catch(() => {});

  const shutdown = () => {
    console.log("\n🛑 Shutting down opencodex proxy...");
    server.stop(true);
    removePid();
    // Under the service (OCX_SERVICE), a restart re-injects on start — don't churn Codex config.
    // `ocx service stop/uninstall` restore explicitly.
    if (!process.env.OCX_SERVICE) { try { restoreNativeCodex(); } catch { /* best-effort restore */ } }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function killProxy(pid: number): void {
  if (process.platform === "win32") {
    try {
      (require("node:child_process") as typeof import("node:child_process"))
        .execSync(`taskkill /PID ${pid} /T /F`, { stdio: "pipe" });
    } catch { /* process already gone */ }
  } else {
    process.kill(pid, "SIGTERM");
  }
}

function handleStop() {
  const pid = readPid();
  if (pid) {
    try {
      killProxy(pid);
      console.log(`✅ Proxy (PID ${pid}) stopped.`);
    } catch {
      console.log("Proxy process not found.");
    }
    removePid();
  } else {
    console.log("No running proxy found.");
  }
  // Recover native Codex so plain `codex` keeps working while the proxy is down.
  const r = restoreNativeCodex();
  console.log(`↩️  ${r.message}`);
}

function handleStatus() {
  const pid = readPid();
  if (pid) {
    console.log(`✅ Proxy running (PID ${pid})`);
  } else {
    console.log("❌ Proxy not running");
  }
}

switch (command) {
  case "init": {
    const { runInit } = await import("./init");
    await runInit();
    break;
  }
  case "start":
    handleStart();
    break;
  case "stop":
    handleStop();
    break;
  case "restore":
  case "eject": {
    const r = restoreNativeCodex();
    console.log(r.success ? `✅ ${r.message}` : `⚠️  ${r.message}`);
    console.log("Plain `codex` now runs natively (no proxy).");
    break;
  }
  case "status":
    handleStatus();
    break;
  case "login": {
    const { handleLogin } = await import("./oauth/login-cli");
    await handleLogin(args[1]);
    break;
  }
  case "logout": {
    const { removeCredential } = await import("./oauth/store");
    const name = (args[1] ?? "").trim().toLowerCase();
    removeCredential(name);
    console.log(`Logged out of ${name || "(none)"}.`);
    break;
  }
  case "sync": {
    await syncModelsToCodex();
    break;
  }
  case "gui": {
    const cfg = await import("./config");
    const config = cfg.loadConfig();
    const guiUrl = `http://localhost:${config.port}`;
    if (!cfg.readPid()) {
      console.log("Proxy not running. Starting...");
      handleStart();
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`Opening ${guiUrl}`);
    const { openUrl } = await import("./open-url");
    openUrl(guiUrl);
    break;
  }
  case "service":
    serviceCommand(args[1]);
    break;
  case "update": {
    const { runUpdate } = await import("./update");
    runUpdate();
    break;
  }
  case "help":
  case "--help":
  case "-h":
  case undefined:
    printUsage();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}
