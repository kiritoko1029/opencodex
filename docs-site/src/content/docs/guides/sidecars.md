---
title: "Sidecars: Web Search & Vision"
description: Give non-OpenAI models real web search and image understanding by borrowing a gpt-5.4-mini over your ChatGPT login.
---

Some capabilities only exist on OpenAI's hosted backend — real server-side **web search** and native
**image input**. opencodex backfills them for *any* routed model with two sidecars that borrow a small
`gpt-5.4-mini` over your ChatGPT-login (`forward`) provider. Both are **on by default** when a forward
provider exists and you're logged in, and both degrade gracefully — a failure never breaks the turn.

:::note[Requires a forward provider]
Sidecars run through the `forward` (ChatGPT passthrough) path — the only one with hosted web search
and native vision. If you aren't logged into ChatGPT, sidecars simply skip and the turn proceeds.
:::

## Web-search sidecar

When Codex enables hosted `web_search` but the routed model is non-OpenAI (which can't run it
server-side), opencodex:

1. **Drops** the hosted `web_search` tool and exposes a synthetic `web_search(query)` **function**
   tool to the routed model instead.
2. Runs the model in a small **agentic loop**. When it calls `web_search`, opencodex executes a real
   search by calling `gpt-5.4-mini` (with the hosted `web_search` tool, `reasoning.effort: "low"`)
   over the forward backend, parses the streamed answer + citations, and injects them back as a tool
   result.
3. **Loops** until the model answers or `maxSearchesPerTurn` (default 3) is hit, then forces a final
   answer. Real tool calls (e.g. `apply_patch`, shell) finalize the turn so they reach Codex.

The injected result is wrapped in an untrusted-data boundary (the model is told not to follow
instructions inside it), capped in length, and de-duplicated by source URL. In structured-output
turns (`text.format` = json_schema / json_object) the result is handed over as compact JSON instead of
prose so it can't corrupt the model's schema-constrained answer. For text-only routed models, the
search model is told to **describe relevant images in words** and include their URLs.

```json
{
  "webSearchSidecar": {
    "enabled": true,
    "model": "gpt-5.4-mini",
    "reasoning": "low",
    "maxSearchesPerTurn": 3,
    "timeoutMs": 30000
  }
}
```

## Vision sidecar

When the routed model is text-only (listed in the provider's `noVisionModels`) and a request carries
an image, opencodex describes each image **before** the main call and replaces it with text, so the
text-only model can still reason about what's in it.

- Images come from user messages **and** tool results (e.g. Codex's `view_image`).
- Each image is sent to a `gpt-5.4-mini` vision model (`reasoning.effort: "low"`); the description
  replaces the image part inline.
- Descriptions run with **bounded concurrency** (3 at a time, order preserved), are length-capped, and
  the describer is capped at `max_output_tokens`.
- Image URLs are validated before forwarding: data URLs must be an allowed image type
  (`png`/`jpeg`/`webp`/`gif`) within ~20 MB; only `data:` and `https:` schemes are accepted. (Remote
  `https` images are fetched by the OpenAI backend, not by the proxy.)
- `noVisionModels` matching is tolerant of an Ollama-style `:size` tag, so a `gpt-oss` entry covers
  `gpt-oss:120b`.

```json
{
  "visionSidecar": {
    "enabled": true,
    "model": "gpt-5.4-mini",
    "timeoutMs": 45000
  }
}
```

A model is marked text-only per provider:

```json
{
  "providers": {
    "ollama-cloud": {
      "adapter": "openai-chat",
      "baseUrl": "https://ollama.com/v1",
      "noVisionModels": ["glm-5.2", "gpt-oss", "qwen3-coder", "deepseek-v4-pro"]
    }
  }
}
```

## Disabling

Set `enabled: false` on either sidecar in `config.json`, or simply don't run a forward provider.
See the [Configuration reference](/opencodex/reference/configuration/#sidecars) for every field.
