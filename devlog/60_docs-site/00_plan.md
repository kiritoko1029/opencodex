# Plan — opencodex developer docs site (Astro Starlight) + README + GitHub Pages

**Goal:** A jawcode-grade, very detailed developer-documentation site for opencodex, built as an
**Astro + Starlight** static site, deployed to **GitHub Pages**, plus a rewritten accurate README.
Push to a new public GitHub repo `lidge-jun/opencodex` (no remote exists yet; gh authed as lidge-jun).

## Part 1 — Plain explanation
opencodex currently has only a 151-line README (partly stale). We add a full documentation website —
like the jawcode docs site, but built with Astro Starlight (the standard Astro docs framework, static,
free on GitHub Pages). It explains every part of the proxy: install, how it routes Codex to any LLM,
every provider/adapter, the config + CLI reference, Codex injection, and the web-search/vision
sidecars. We also rewrite the README to be accurate and link to the site, and add a GitHub Actions
workflow that builds and publishes the site to GitHub Pages on every push to main.

## Tech decision
- **Astro + Starlight** (`@astrojs/starlight`): the user asked for an Astro static page; Starlight is
  the official Astro docs theme — content in MD/MDX, built-in sidebar/search/dark-mode, GH-Pages ready.
- Lives in a new top-level `docs-site/` dir (mirrors jawcode's `docs-site/`; isolated from the `src/`
  proxy package so `bun run build`/publish of the proxy is unaffected). Matches existing repo
  convention of decade-numbered `devlog/NN_*` (this plan = `devlog/60_docs-site/`).

## File change map

### NEW — Astro Starlight site under `docs-site/`
| Path | Purpose |
|------|---------|
| `docs-site/package.json` | astro + @astrojs/starlight + sharp; scripts dev/build/preview |
| `docs-site/astro.config.mjs` | Starlight config: title, `site`/`base` for GH Pages (`/opencodex`), sidebar nav, social links, edit-link |
| `docs-site/tsconfig.json` | extends astro/tsconfigs/strict |
| `docs-site/.gitignore` | dist/, node_modules/, .astro/ |
| `docs-site/src/content.config.ts` | Starlight docs loader/collection |
| `docs-site/src/content/docs/index.mdx` | Landing: hero, "what is opencodex", the Codex↔provider diagram, quick links |
| `docs-site/src/content/docs/getting-started/installation.mdx` | Install (bun/npm), prerequisites, verify |
| `docs-site/src/content/docs/getting-started/quickstart.mdx` | `ocx init` → `ocx start` → use Codex; first provider |
| `docs-site/src/content/docs/getting-started/how-it-works.mdx` | Request lifecycle: Responses→parse→route→adapter→bridge→SSE (diagram) |
| `docs-site/src/content/docs/guides/providers.mdx` | OAuth (xai/anthropic/kimi), API-key catalog (incl. Ollama Cloud), forward/passthrough, full table |
| `docs-site/src/content/docs/guides/model-routing.mdx` | The 5-step routing precedence, `provider/model` syntax, prefix patterns |
| `docs-site/src/content/docs/guides/codex-integration.mdx` | config.toml injection, model catalog sync, subagent picker (≤5 routed), restore/eject |
| `docs-site/src/content/docs/guides/sidecars.mdx` | Web-search sidecar + vision sidecar: why, how, config, the gpt-mini path |
| `docs-site/src/content/docs/guides/web-dashboard.mdx` | GUI: status, provider mgmt, request log, add-provider flow |
| `docs-site/src/content/docs/reference/cli.mdx` | Every `ocx` command + flags (init/start/stop/restore/sync/status/login/logout/gui/service) |
| `docs-site/src/content/docs/reference/configuration.mdx` | Full OcxConfig + OcxProviderConfig + sidecar config field reference (tables) |
| `docs-site/src/content/docs/reference/adapters.mdx` | Each adapter (openai-chat, openai-responses, anthropic, google, azure, image utils) + quirks |
| `docs-site/src/content/docs/reference/architecture.mdx` | Module map, AdapterEvent/bridge event table, parser, cache, types |
| `docs-site/src/content/docs/contributing.mdx` | Dev setup, project layout, conventions (ESM, 500-line, devlog), tsc gate |
| `docs-site/public/favicon.svg` | Simple favicon |

### NEW — CI
| Path | Purpose |
|------|---------|
| `.github/workflows/deploy-docs.yml` | Build Starlight (bun) + deploy to GitHub Pages via actions/deploy-pages |

### MODIFY
| Path | Change |
|------|--------|
| `README.md` | Rewrite: accurate provider/adapter tables, OAuth + Ollama Cloud, sidecars, subagent picker, docs-site link/badge, correct `src/adapters/azure.ts` (already correct), full CLI list |

## Accuracy anchors (verified against code this session)
- Adapters dir: `anthropic.ts, azure.ts, base.ts, google.ts, image.ts, openai-chat.ts, openai-responses.ts`.
- CLI cmds: init, start, stop, restore/eject, sync, status, login, logout, gui, service{install|start|stop|status|uninstall}.
- Routing precedence: `provider/model` → provider.defaultModel → provider.models[] → prefix patterns (claude-/gpt-/o1-/o3-/o4-/llama-/…) → defaultProvider.
- Config path `~/.opencodex/config.json`; default provider = openai forward (ChatGPT passthrough).
- Sidecars: web-search (gpt-5.4-mini real web_search via forward) + vision (describe images for noVisionModels).

## GitHub Pages deploy
- `astro.config.mjs`: `site: "https://lidge-jun.github.io"`, `base: "/opencodex"`.
- Repo: create public `lidge-jun/opencodex`, push `main`. Enable Pages (source = GitHub Actions).
- Workflow triggers on push to main affecting `docs-site/**`; builds with bun; publishes `docs-site/dist`.

## Phases (compact PABCD, push is pre-authorized; multiple rounds OK)
- **B1**: scaffold + all pages + README + workflow. **C**: `bun install` + `astro build` (must pass) + `tsc` of main unaffected. **D**: create repo, push, enable Pages, verify Actions run + live URL.
