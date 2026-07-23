import type { IncomingMeta } from "./base";
import type { OcxProviderConfig } from "../types";

function hasHeaderCaseInsensitive(
  headers: Record<string, string> | undefined,
  target: string,
): boolean {
  const needle = target.toLowerCase();
  return Object.keys(headers ?? {}).some(key => key.toLowerCase() === needle);
}

/**
 * Opt-in copy of the caller's User-Agent onto the upstream request for custom
 * provider channels. Skips when `provider.headers` already sets User-Agent
 * (any casing) so static config always wins.
 */
export function applyForwardUserAgent(
  headers: Record<string, string>,
  provider: OcxProviderConfig,
  incoming?: IncomingMeta,
): void {
  if (!provider.forwardUserAgent) return;
  if (hasHeaderCaseInsensitive(provider.headers, "user-agent")) return;
  const ua = incoming?.headers.get("user-agent");
  if (ua) headers["User-Agent"] = ua;
}
