---
title: Architecture
description: opencodex internals — module map, the AdapterEvent bridge, the request parser, and caching.
---

opencodex is a single Bun process. A request enters as OpenAI Responses, is normalized to an internal
model, routed, sent to a provider via an adapter, and bridged back to Responses SSE. See
[How It Works](/opencodex/getting-started/how-it-works/) for the end-to-end flow.

## Module map

```
src/
├── cli.ts              # ocx command dispatch
├── index.ts            # public entry
├── server.ts           # Bun.serve: /v1/* proxy + /api/* management API
├── router.ts           # model id → provider + adapter
├── config.ts           # ~/.opencodex/config.json, defaults, PID, env resolution
├── service.ts          # launchd / Task Scheduler background service
├── init.ts             # interactive setup wizard
├── bridge.ts           # AdapterEvent stream → Responses SSE
├── codex-inject.ts     # ~/.codex/config.toml injection + restore
├── codex-catalog.ts    # routed-model catalog merge + subagent ranking
├── model-cache.ts      # per-provider /models TTL cache
├── types.ts            # core interfaces + helpers (modelInList, namespacedToolName)
├── responses/
│   ├── parser.ts       # Responses request → OcxParsedRequest
│   └── schema.ts       # Zod validation
├── adapters/           # base + openai-chat, openai-responses, anthropic, google, azure, image
├── oauth/              # OAuth providers, API-key catalog, token store/refresh
├── web-search/         # web-search sidecar (synthetic tool, loop, executor, parser)
└── vision/             # vision sidecar (describe + plan)
```

## The parser

`responses/parser.ts` validates the incoming request with `responses/schema.ts` (Zod), then builds an
`OcxParsedRequest`:

- **Messages** — `input` items become a normalized `OcxMessage[]`: user / developer / assistant /
  toolResult. `reasoning` items become thinking blocks; `function_call`, `custom_tool_call`, and
  `tool_search_call` items become tool calls; their `*_output` counterparts become tool results.
- **Tools** — function tools pass through; **namespaced (MCP) tools are flattened** to
  `namespace__name` (and restored on the way back); **freeform** tools (e.g. `apply_patch`) and
  **tool_search** discovery tools are flagged; **hosted tools** (`web_search`, image gen, …) are
  dropped and re-injected by a sidecar only if it will handle them.
- **Images** — preserved as real content parts (data URL or remote https), never inlined as text.
- **Feature flags** — `_webSearch` (hosted web search requested) and `_structuredOutput`
  (`text.format` is json_schema / json_object).

## The bridge

`bridge.ts` turns the adapter's internal `AdapterEvent` stream back into Responses SSE that Codex
understands:

| AdapterEvent | Responses SSE emitted |
| --- | --- |
| `text_delta` | `response.output_text.delta` → `…done`, `response.content_part.done`, `response.output_item.done` |
| `thinking_delta` | `response.reasoning_summary_text.delta` → `…done`, item close |
| `tool_call_start` | `response.output_item.added` (type: `function_call` / `custom_tool_call` / `tool_search_call`) |
| `tool_call_delta` | `response.function_call_arguments.delta` (skipped for freeform / tool_search) |
| `tool_call_end` | `response.function_call_arguments.done` → `response.output_item.done` |
| `done` | `response.completed` (with usage) |
| `error` | `response.failed` (with `last_error`) |

Tool calls are disambiguated into three Responses item types using the namespace map, the freeform
set, and the tool-search set captured by the parser — so MCP namespaces, `apply_patch`-style freeform
tools, and client-executed `tool_search` all round-trip. A `buildResponseJSON()` variant produces a
single non-streaming response object from the same events.

## Caching & the catalog

- `model-cache.ts` keeps a per-provider, in-memory TTL cache of live `/models` results (default 5 min,
  matching Codex's own cache), with a stale-fallback when a fetch fails.
- `codex-catalog.ts` merges routed models into Codex's catalog as namespaced entries, ranks featured
  [subagent models](/opencodex/guides/codex-integration/#the-subagent-picker) first, filters
  `disabledModels`, and can fully restore the pristine catalog from a one-time backup.

## Core types

The internal model lives in `types.ts`: `OcxParsedRequest`, `OcxContext`, the `OcxMessage` union,
`OcxContentPart` (text / image), `OcxToolCall`, `OcxTool`, `AdapterEvent`, and the config types
(`OcxConfig`, `OcxProviderConfig`). Two helpers are widely used: `namespacedToolName()` and
`modelInList()` (tolerant `:size`-tag matching for `noVisionModels` / `noReasoningModels`).
