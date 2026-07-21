/**
 * Which Live client transport to use.
 *
 * Prefer WebSocket everywhere (local via `vercel dev`, production on Vercel Fluid).
 * Split HTTP is localhost / `next dev` only — never auto-selected on deployed hosts.
 */
export type LiveTransportMode = "websocket" | "duplex" | "legacy-http";

export type ResolveLiveTransportInput = {
  hostname: string;
  /** NEXT_PUBLIC_LIVE_WS */
  liveWsFlag?: string;
  /**
   * NEXT_PUBLIC_LIVE_HTTP — force split HTTP.
   * Debug only; unsafe on multi-instance production.
   */
  liveHttpFlag?: string;
  /** NEXT_PUBLIC_LIVE_DUPLEX — opt into duplex on localhost after WS fail */
  liveDuplexFlag?: string;
  supportsDuplexFetch: boolean;
  /**
   * When true, WebSocket was preferred but failed to connect.
   * Duplex is the same-request fallback on deployed hosts.
   */
  websocketFailed?: boolean;
};

export function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Resolve transport for the Live client.
 */
export function resolveLiveTransportMode(
  input: ResolveLiveTransportInput,
): LiveTransportMode {
  const wsFlag = input.liveWsFlag?.trim();
  const httpFlag = input.liveHttpFlag?.trim();
  const duplexFlag = input.liveDuplexFlag?.trim();
  const local = isLocalHostname(input.hostname);

  // Explicit force — documented as debug-only for production.
  if (httpFlag === "1") return "legacy-http";

  // Default: WebSocket on localhost and production (use `vercel dev` locally).
  const preferWs = wsFlag !== "0";

  if (preferWs && !input.websocketFailed) return "websocket";

  // After WS failure / WS disabled:
  // Localhost → split HTTP (next dev), unless duplex opted in.
  if (local && duplexFlag !== "1") {
    return "legacy-http";
  }

  if (duplexFlag === "0") {
    return local ? "legacy-http" : "websocket";
  }

  if (input.supportsDuplexFetch) return "duplex";

  // Deployed without duplex support: do not fall back to split HTTP
  // (openLiveConnection rethrows when mode stays "websocket" after failure).
  return local ? "legacy-http" : "websocket";
}
