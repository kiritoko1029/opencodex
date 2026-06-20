<p align="center">
  <img src="assets/banner.png" alt="opencodex — 使用任意 LLM 的通用代理" width="820">
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <b>简体中文</b> · 📖 <a href="https://lidge-jun.github.io/opencodex/zh-cn/"><b>完整文档 →</b></a>
</p>

<p align="center">
  <img src="assets/architecture.png" alt="opencodex 架构 — Codex CLI 通过 opencodex 代理路由到任意 LLM 提供商" width="820">
</p>

Codex 只能使用 Responses API（`/v1/responses`）。opencodex 位于 Codex 与你的 LLM
provider 之间，实时翻译两者之间的协议 —— 包括 streaming、工具调用、推理（reasoning）和图像
—— 并且是双向的。

```
Codex CLI / App / SDK ──/v1/responses──▶ opencodex ──▶ Any provider
                                              │
              Anthropic · Google · xAI · Kimi · Ollama Cloud · Groq
              OpenRouter · Azure · DeepSeek · GLM · …and OpenAI itself
```

## 快速开始

```bash
# Install
npm install -g @bitkyc08/opencodex      # or: bun install -g @bitkyc08/opencodex

# Interactive setup (writes config + injects into Codex)
ocx init

# Start the proxy
ocx start

# Use Codex normally — it now routes through opencodex
codex "Write a hello world in Rust"
```

<details>
<summary><b>没有 <a href="https://bun.sh">bun</a>？</b> —— 先安装它（opencodex 运行在 bun 上）</summary>

<br/>

```bash
# macOS / Linux / WSL
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

然后重新运行 `npm install -g @bitkyc08/opencodex`。（`ocx` 可执行文件是 bun 原生的，因此 bun 必须在你的 `PATH` 中。）

</details>

使用 `provider/model` 形式指定一个具体的已路由模型：

```bash
codex -m "anthropic/claude-opus-4-8" "Explain this stack trace"
codex -m "ollama-cloud/glm-5.2"      "Write a SQL migration"
```

## 亮点

- **五种 adapter**，覆盖 Anthropic Messages、Google Gemini、Azure、OpenAI Responses 直通（passthrough），
  以及**所有 OpenAI 兼容的 Chat Completions** 端点。
- **OAuth、API key 或 ChatGPT 转发（forward）。** 用你的 xAI / Anthropic / Kimi 账户登录（token
  自动刷新）、转发你的 `codex login`，或直接粘贴一个 key（支持 `${ENV_VARS}`）。内置一份 18 家 provider 的
  API-key 目录（含 **Ollama Cloud**）。
- **无缝接入 Codex CLI、TUI、App 和 SDK。** 向 `$CODEX_HOME/config.toml`（默认 `~/.codex/config.toml`）
  注入一个 `[model_providers.opencodex]` 表，并写入共享的 Codex 模型目录，让已路由的模型出现在
  Codex 模型选择器中。
- **Subagent 控制。** 通过 `subagentModels` 或 Web 仪表盘，将最多 5 个路由或原生模型优先展示在
  Codex 的 `spawn_agent` 选择器中。
- **默认 HTTP/SSE，WebSocket 需要显式开启。** 代理有 Responses WebSocket 端点，但只有设置
  `"websockets": true` 时才会广告 `supports_websockets`。
- **Sidecars。** 通过基于你 ChatGPT 登录的 `gpt-5.4-mini`，为非 OpenAI 模型提供真正的**网页搜索**和**图像理解**能力。
- **Web 仪表盘**，用于管理 provider、OAuth 登录、模型选择和请求日志。

## Providers 与 adapters

| Provider | Adapter | Auth |
|---|---|---|
| OpenAI（ChatGPT 登录） | `openai-responses` | 转发（无需 key） |
| OpenAI（API key） | `openai-responses` | key |
| Anthropic Claude | `anthropic` | oauth / key |
| xAI Grok | `openai-chat` | oauth / key |
| Kimi（Moonshot） | `openai-chat` | oauth / key |
| Google Gemini | `google` | key |
| Azure OpenAI | `azure` | key |
| Ollama Cloud + 17 家 provider 目录 | `openai-chat` | key |
| Ollama / vLLM / LM Studio（本地） | `openai-chat` | key（通常留空） |
| 任意 OpenAI 兼容端点 | `openai-chat` | key |

## CLI

```bash
ocx init                       # interactive setup
ocx start [--port 10100]       # start the proxy
ocx stop                       # stop + restore native Codex
ocx restore                    # restore without stopping (alias: ocx eject)
ocx sync                       # refresh models + re-inject into Codex
ocx status                     # is the proxy running?
ocx login <xai|anthropic|kimi> # OAuth login
ocx logout <provider>          # remove a stored login
ocx gui                        # open the web dashboard
ocx service <install|start|stop|status|uninstall>   # run as a background service
ocx update                     # update opencodex to the latest published version
```

## 配置

配置文件位于 `~/.opencodex/config.json`。最小示例：

```json
{
  "port": 10100,
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": {
      "adapter": "anthropic",
      "baseUrl": "https://api.anthropic.com",
      "authMode": "oauth",
      "defaultModel": "claude-sonnet-4-6"
    },
    "ollama-cloud": {
      "adapter": "openai-chat",
      "baseUrl": "https://ollama.com/v1",
      "apiKey": "${OLLAMA_API_KEY}",
      "defaultModel": "glm-5.2"
    }
  }
}
```

WebSocket 传输默认关闭。只有当你希望 Codex 广告并使用 Responses WebSocket 路径而不是 HTTP/SSE 时，
才需要设置 `"websockets": true`。

每个字段的说明请参阅 **[配置参考](https://lidge-jun.github.io/opencodex/zh-cn/reference/configuration/)**。

## 文档

公开文档 —— 安装、providers、路由、sidecars、Codex 集成、Codex App 模型选择器，
以及 CLI/配置参考 —— 是位于 [`docs-site/`](./docs-site) 下的一个 Astro 站点，
并发布于 **[lidge-jun.github.io/opencodex](https://lidge-jun.github.io/opencodex/zh-cn/)**。

维护者 source of truth 位于 [`structure/`](./structure)，历史调查/诊断笔记保留在 [`docs/`](./docs)。

## 开发

```bash
git clone https://github.com/lidge-jun/opencodex.git
cd opencodex
bun install
bun run dev          # start the proxy in dev mode
bun x tsc --noEmit   # typecheck
```

请参阅 **[贡献指南](https://lidge-jun.github.io/opencodex/zh-cn/contributing/)**。

## 许可证

MIT
