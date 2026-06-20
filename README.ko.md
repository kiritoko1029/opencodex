<p align="center">
  <img src="assets/banner.png" alt="opencodex — 어떤 LLM이든 Codex에서 사용" width="820">
</p>

<p align="center">
  <a href="README.md">English</a> · <b>한국어</b> · <a href="README.zh-CN.md">简体中文</a> · 📖 <a href="https://lidge-jun.github.io/opencodex/ko/"><b>전체 문서 →</b></a>
</p>

<p align="center">
  <img src="assets/architecture.png" alt="opencodex 아키텍처 — Codex CLI가 opencodex 프록시를 통해 모든 LLM 프로바이더로 라우팅" width="820">
</p>

Codex는 오직 Responses API(`/v1/responses`)만 사용합니다. opencodex는 Codex와 여러분의 LLM
프로바이더 사이에 위치하여, 프로토콜을 실시간으로 변환합니다 — streaming, tool 호출, reasoning, 이미지까지
모두 포함해서 — 양방향으로 동작합니다.

```
Codex CLI / App / SDK ──/v1/responses──▶ opencodex ──▶ Any provider
                                              │
              Anthropic · Google · xAI · Kimi · Ollama Cloud · Groq
              OpenRouter · Azure · DeepSeek · GLM · …and OpenAI itself
```

## 빠른 시작

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
<summary><b><a href="https://bun.sh">bun</a>이 없으신가요?</b> — 먼저 설치하세요 (opencodex는 bun에서 실행됩니다)</summary>

<br/>

```bash
# macOS / Linux / WSL
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

설치 후 `npm install -g @bitkyc08/opencodex`를 다시 실행하세요. (`ocx` 바이너리는 bun 기반이라 bun이 `PATH`에 있어야 합니다.)

</details>

`provider/model` 형식으로 라우팅된 특정 모델을 지정할 수 있습니다:

```bash
codex -m "anthropic/claude-opus-4-8" "Explain this stack trace"
codex -m "ollama-cloud/glm-5.2"      "Write a SQL migration"
```

## 주요 기능

- **다섯 가지 adapter**로 Anthropic Messages, Google Gemini, Azure, OpenAI Responses passthrough,
  그리고 **모든 OpenAI 호환 Chat Completions** 엔드포인트를 지원합니다.
- **OAuth, API 키, 또는 ChatGPT forward.** xAI / Anthropic / Kimi 계정으로 로그인하거나(토큰은
  자동 갱신됩니다), `codex login`을 forward 하거나, 키를 붙여넣으세요(`${ENV_VARS}` 지원). 18개 프로바이더의
  API 키 카탈로그(**Ollama Cloud** 포함)가 기본 내장되어 있습니다.
- **Codex CLI, TUI, App, SDK에 바로 통합.** `$CODEX_HOME/config.toml`(기본값 `~/.codex/config.toml`)에
  `[model_providers.opencodex]` 테이블을 주입하고 공유 Codex 모델 카탈로그를 작성하여 라우팅된 모델이
  Codex 모델 선택기에 표시되게 합니다.
- **서브에이전트 제어.** `subagentModels` 또는 웹 대시보드에서 최대 5개의 라우팅/네이티브 모델을
  Codex `spawn_agent` 선택기에 우선 노출할 수 있습니다.
- **기본은 HTTP/SSE, WebSocket은 opt-in.** 프록시는 Responses WebSocket 엔드포인트를 갖고 있지만,
  `"websockets": true`일 때만 `supports_websockets`를 광고합니다.
- **Sidecar.** OpenAI가 아닌 모델에도 ChatGPT 로그인을 통한 `gpt-5.4-mini`를 사용해 실제 **웹 검색**과
  **이미지 이해** 기능을 제공합니다.
- 프로바이더, OAuth 로그인, 모델 선택, 요청 로그를 위한 **웹 대시보드**.

## 프로바이더 및 adapter

| Provider | Adapter | Auth |
|---|---|---|
| OpenAI (ChatGPT login) | `openai-responses` | forward (키 불필요) |
| OpenAI (API key) | `openai-responses` | key |
| Anthropic Claude | `anthropic` | oauth / key |
| xAI Grok | `openai-chat` | oauth / key |
| Kimi (Moonshot) | `openai-chat` | oauth / key |
| Google Gemini | `google` | key |
| Azure OpenAI | `azure` | key |
| Ollama Cloud + 17개 프로바이더 카탈로그 | `openai-chat` | key |
| Ollama / vLLM / LM Studio (로컬) | `openai-chat` | key (보통 비워둠) |
| 모든 OpenAI 호환 엔드포인트 | `openai-chat` | key |

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

## 설정

설정은 `~/.opencodex/config.json`에 저장됩니다. 최소 예시:

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

WebSocket 전송은 기본적으로 꺼져 있습니다. Codex가 HTTP/SSE 대신 Responses WebSocket 경로를 광고하고
사용하게 하려면 `"websockets": true`를 명시하세요.

모든 필드에 대한 자세한 내용은 **[설정 레퍼런스](https://lidge-jun.github.io/opencodex/ko/reference/configuration/)**
를 참고하세요.

## 문서

공개 문서 — 설치, 프로바이더, 라우팅, sidecar, Codex 통합, Codex App 모델 선택기,
CLI/설정 레퍼런스 — 는 [`docs-site/`](./docs-site) 아래의 Astro 사이트이며
**[lidge-jun.github.io/opencodex](https://lidge-jun.github.io/opencodex/ko/)**에 게시됩니다.

유지보수용 source of truth는 [`structure/`](./structure)에 있고, 과거 조사/진단 노트는
[`docs/`](./docs)에 남아 있습니다.

## 개발

```bash
git clone https://github.com/lidge-jun/opencodex.git
cd opencodex
bun install
bun run dev          # start the proxy in dev mode
bun x tsc --noEmit   # typecheck
```

**[기여하기](https://lidge-jun.github.io/opencodex/ko/contributing/)**를 참고하세요.

## 라이선스

MIT
