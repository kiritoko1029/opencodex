import { describe, expect, test } from "bun:test";
import { createOpenAIChatAdapter } from "../src/adapters/openai-chat";
import { createResponsesPassthroughAdapter } from "../src/adapters/openai-responses";
import { headersForCodexAuthContext } from "../src/codex/auth-context";
import type { OcxParsedRequest, OcxProviderConfig } from "../src/types";

const CLIENT_UA = "codex-cli/0.1.0 (test)";

function chatParsed(): OcxParsedRequest {
  return {
    modelId: "gpt-4o",
    stream: false,
    context: { messages: [{ role: "user", content: "hi" }], tools: [] },
    options: {},
  };
}

function responsesParsed(): OcxParsedRequest {
  return {
    modelId: "gpt-5.1",
    stream: false,
    context: { messages: [], tools: [] },
    options: {},
    _rawBody: { model: "gpt-5.1", input: [{ type: "message", role: "user", content: "hi" }] },
  };
}

function incomingWithUa(ua = CLIENT_UA) {
  return { headers: new Headers({ "user-agent": ua, authorization: "Bearer unused" }) };
}

describe("forwardUserAgent opt-in", () => {
  test("headersForCodexAuthContext preserves caller user-agent", () => {
    const headers = headersForCodexAuthContext(
      new Headers({ authorization: "Bearer t", "user-agent": CLIENT_UA, "openai-beta": "responses=experimental" }),
      { kind: "main", accountId: null },
    );
    expect(headers.get("user-agent")).toBe(CLIENT_UA);
    expect(headers.get("openai-beta")).toBe("responses=experimental");
  });

  test("openai-chat default leaves User-Agent unset", () => {
    const provider: OcxProviderConfig = {
      adapter: "openai-chat",
      baseUrl: "https://example.com/v1",
      apiKey: "sk-test",
    };
    const req = createOpenAIChatAdapter(provider).buildRequest(chatParsed(), incomingWithUa());
    expect(req.headers["User-Agent"]).toBeUndefined();
    expect(req.headers["user-agent"]).toBeUndefined();
  });

  test("openai-chat forwards caller User-Agent when enabled", () => {
    const provider: OcxProviderConfig = {
      adapter: "openai-chat",
      baseUrl: "https://example.com/v1",
      apiKey: "sk-test",
      forwardUserAgent: true,
    };
    const req = createOpenAIChatAdapter(provider).buildRequest(chatParsed(), incomingWithUa());
    expect(req.headers["User-Agent"]).toBe(CLIENT_UA);
  });

  test("openai-chat static headers User-Agent wins over forward", () => {
    const provider: OcxProviderConfig = {
      adapter: "openai-chat",
      baseUrl: "https://example.com/v1",
      apiKey: "sk-test",
      forwardUserAgent: true,
      headers: { "User-Agent": "static-custom-ua" },
    };
    const req = createOpenAIChatAdapter(provider).buildRequest(chatParsed(), incomingWithUa());
    expect(req.headers["User-Agent"]).toBe("static-custom-ua");
  });

  test("openai-responses key mode forwards caller User-Agent when enabled", () => {
    const provider: OcxProviderConfig = {
      adapter: "openai-responses",
      baseUrl: "https://example.com/v1",
      apiKey: "sk-test",
      authMode: "key",
      forwardUserAgent: true,
    };
    const req = createResponsesPassthroughAdapter(provider).buildRequest(responsesParsed(), incomingWithUa());
    expect(req.headers["User-Agent"]).toBe(CLIENT_UA);
  });

  test("openai-responses key mode static User-Agent wins over forward", () => {
    const provider: OcxProviderConfig = {
      adapter: "openai-responses",
      baseUrl: "https://example.com/v1",
      apiKey: "sk-test",
      authMode: "key",
      forwardUserAgent: true,
      headers: { "user-agent": "static-responses-ua" },
    };
    const req = createResponsesPassthroughAdapter(provider).buildRequest(responsesParsed(), incomingWithUa());
    expect(req.headers["user-agent"]).toBe("static-responses-ua");
    expect(Object.keys(req.headers).filter(k => k.toLowerCase() === "user-agent")).toEqual(["user-agent"]);
  });

  test("openai-responses forward mode does not emit User-Agent from opt-in", () => {
    const provider: OcxProviderConfig = {
      adapter: "openai-responses",
      baseUrl: "https://chatgpt.com/backend-api/codex",
      authMode: "forward",
      forwardUserAgent: true,
    };
    const req = createResponsesPassthroughAdapter(provider).buildRequest(
      responsesParsed(),
      { headers: new Headers({ authorization: "Bearer tok", "user-agent": CLIENT_UA }) },
    );
    expect(req.headers["User-Agent"]).toBeUndefined();
    expect(req.headers["user-agent"]).toBeUndefined();
  });
});
