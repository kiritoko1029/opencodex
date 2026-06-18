---
title: Web Dashboard
description: The opencodex GUI — proxy status, provider management, model picker, and request logs.
---

opencodex ships a local web dashboard (a Vite/React app under `gui/`) served from the proxy. It's the
easiest way to add providers, log in with OAuth, choose subagent models, and watch traffic.

## Opening it

```bash
ocx gui
```

This opens `http://localhost:<port>` in your browser (auto-starting the proxy first if needed). In
development you can run the GUI dev server separately against a running proxy:

```bash
ocx start
cd gui && bun dev
```

## What you can do

| Area | What it does |
| --- | --- |
| **Status** | Live proxy state, port, uptime, and PID. |
| **Providers** | Add, edit, enable/disable, and remove providers. |
| **Add provider** | A searchable picker of presets — OAuth login (xAI / Anthropic / Kimi), ChatGPT forward, the API-key catalog (incl. Ollama Cloud), local servers, and Custom. |
| **OAuth login** | Opens the provider's auth page and polls until the token lands; or imports an existing local CLI/keychain token. |
| **Subagent models** | Pick the ≤5 routed models Codex's `spawn_agent` advertises. |
| **Models** | Enable/disable individual routed models (hidden ones are excluded from the catalog and `/v1/models`). |
| **Request log** | Auto-refreshing view of recent requests (model, provider, status). |

## How the dashboard talks to the proxy

The GUI is a thin client over the proxy's management API. Useful endpoints (all JSON):

| Endpoint | Purpose |
| --- | --- |
| `GET /api/providers` | List configured providers. |
| `POST /api/providers` | Add or overwrite a provider (catalog entries are enriched with their model classification automatically). |
| `DELETE /api/providers?name=…` | Remove a provider. |
| `GET /api/key-providers` | The API-key catalog (incl. Ollama Cloud). |
| `GET /api/oauth/providers` | Which providers support OAuth login. |
| `POST /api/oauth/login` · `GET /api/oauth/status` | Start an OAuth flow and poll for completion. |
| `GET` / `PUT /api/subagent-models` | Read / set the featured subagent models. |

:::tip
Adding **Ollama Cloud** (or any catalog provider) from the dashboard automatically copies its
text-vs-vision model classification into your config, so the [vision sidecar](/opencodex/guides/sidecars/)
is gated correctly without any manual setup.
:::
