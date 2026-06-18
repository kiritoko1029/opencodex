---
title: Codex Integration
description: How opencodex injects itself into Codex, syncs the model catalog, drives the subagent picker, and restores cleanly.
---

opencodex makes Codex route through the proxy by editing two things Codex reads: its config
(`~/.codex/config.toml`) and its model catalog. Every edit is idempotent and reversible.

## Config injection

`ocx init` (and `ocx sync`) call the injector, which writes:

```toml
# at the document root — Codex reads this as the active provider
model_provider = "opencodex"

# appended at end of file (TOML tables are position-independent)
[model_providers.opencodex]
name = "OpenCodex Proxy"
base_url = "http://localhost:10100/v1"
wire_api = "responses"
```

It also writes an optional profile at `~/.codex/opencodex.config.toml` so you can opt in explicitly:

```bash
codex --profile opencodex "…"
```

:::caution
The root `model_provider` key **must** sit before the first `[table]` header, or Codex parses it as
part of a table and ignores it. The injector guarantees this placement and strips any stray or
duplicate copies before re-writing — so re-running `ocx init` / `ocx sync` never produces duplicates.
:::

## Model catalog sync

Codex shows models from an on-disk catalog (`~/.codex/opencodex-catalog.json` by default). On start
and on `ocx sync`, opencodex:

1. **Backs up** the pristine catalog once to `~/.opencodex/catalog-backup.json` (so featuring is
   reversible).
2. **Fetches** each provider's live `/models` list (cached ~5 min; falls back to the last good list,
   then to the provider's configured `models[]`).
3. **Merges** routed models in as namespaced entries (`provider/model`), cloned from a native Codex
   catalog template so Codex's strict parser accepts them.
4. **Filters** anything in `config.disabledModels`.
5. **Re-ranks** so featured models sort first (see below), then writes the merged catalog back.

Routed catalog entries also get their GPT-5 identity rewritten to the real upstream model name, and
only expose `low | medium | high` reasoning levels.

## The subagent picker

Codex's `spawn_agent` only advertises the **first 5 routed models** in the catalog. `subagentModels`
(up to 5 `provider/model` ids) controls which 5 those are by giving them the lowest priority numbers
so they sort first:

```json
{
  "subagentModels": [
    "anthropic/claude-opus-4-8",
    "ollama-cloud/glm-5.2",
    "xai/grok-4.3"
  ]
}
```

Priority ranking: featured (0–4) < other routed (5) < native (9). You can also manage this from the
[web dashboard](/opencodex/guides/web-dashboard/).

## Restoring native Codex

opencodex never traps you. Any of these strip the injected lines and routed catalog entries, leaving
only native slugs:

```bash
ocx stop       # stop the proxy and restore
ocx restore    # restore without stopping  (alias: ocx eject)
```

When opencodex runs as a managed [background service](/opencodex/reference/cli/#ocx-service), it sets
`OCX_SERVICE=1` so a service-driven restart does **not** thrash the Codex config — only an explicit
`ocx stop` / `ocx service stop` restores native Codex.
