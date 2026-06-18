---
title: Contributing
description: Develop opencodex — setup, layout, conventions, and how to add a provider or adapter.
---

## Setup

```bash
git clone https://github.com/lidge-jun/opencodex.git
cd opencodex
bun install
bun run dev          # proxy in dev mode
bun x tsc --noEmit   # typecheck (must be clean)
```

The web dashboard is a separate app:

```bash
cd gui && bun install && bun dev
```

The docs site you're reading lives in `docs-site/` (Astro + Starlight):

```bash
cd docs-site && bun install && bun dev
```

## Conventions

- **ES Modules only** (`import`/`export`), TypeScript, `strict` mode. Keep `bun x tsc --noEmit` clean.
- **~500 lines per file max** — split by responsibility (the `web-search/` and `vision/` sidecars are
  good examples of small, focused modules behind a single `index.ts`).
- **Handle async errors at boundaries** — sidecars never throw into the request path; they degrade to
  a graceful marker.
- **Devlog** — design notes live in `devlog/NN_slug/` with decade-range numbering (`00–09` research,
  `10–19` phase 1, …). New work gets the next decade.
- **Preserve exports** — other modules may depend on them.

## Adding a provider to the catalog

Most providers are just an entry in the API-key catalog (`src/oauth/key-providers.ts`):

```ts
"my-provider": {
  label: "My Provider",
  baseUrl: "https://api.example.com/v1",
  adapter: "openai-chat",
  dashboardUrl: "https://example.com/keys",
  models: ["model-a", "model-b"],
  defaultModel: "model-a",
  noVisionModels: ["model-a"],   // text-only models → vision sidecar describes images
}
```

`enrichProviderFromCatalog()` copies `models` / `noVisionModels` / `noReasoningModels` onto the
created provider config, so classifications take effect automatically. For OAuth providers, add to
`OAUTH_PROVIDERS` in `src/oauth/index.ts` instead.

## Adding an adapter

Implement `ProviderAdapter` (see [Adapters](/opencodex/reference/adapters/)) in `src/adapters/`,
register it in the adapter resolver, and bridge its output to internal `AdapterEvent`s. Reuse
`image.ts` for image handling and follow `openai-chat.ts` as the reference for streaming + tool calls.

## Verify before you claim done

Run the narrowest command that proves your change — `bun x tsc --noEmit` for types, a focused runtime
probe for behavior. opencodex favors small, verifiable commits over large batches.
