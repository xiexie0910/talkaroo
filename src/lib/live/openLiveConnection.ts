/**
 * Client Live transport.
 * Production (Vercel): WebSocket — pinned instance (avoids multi-instance 404s).
 * Localhost: HTTP POST + SSE (single Node process).
 */
import type { LiveBridgeEvent } from "@/lib/live/types";

export type LiveReadyPayload = {
  sessionId: string;
  practiceSessionId?: string;
  model?: string;
  scenarioId?: string;
  starterLine?: string;
  titleKo?: string;
  titleEn?: string;
};

export type LiveConnection = {
  sessionId: string;
  practiceSessionId?: string;
  sendAudio: (base64Pcm: string) => void;
  close: () => void;
};

type OpenOptions = {
  scenarioId: string;
  /** Called synchronously when the session id is known (set refs before events). */
  onReady?: (ready: LiveReadyPayload) => void;
  onEvent: (event: LiveBridgeEvent | { type: "subscribed" }) => void;
  onTransportLost: () => void;
};

function preferWebSocket(): boolean {
  if (typeof window === "undefined") return false;
  const flag = process.env.NEXT_PUBLIC_LIVE_WS?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1";
}

function liveWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/live/ws`;
}

export async function openLiveConnection(
  options: OpenOptions,
): Promise<LiveConnection> {
  if (preferWebSocket()) {
    try {
      return await openViaWebSocket(options);
    } catch (err) {
      // Fall back if Fluid WS isn't available on this deploy.
      console.warn("[live] WebSocket unavailable, falling back to HTTP", err);
    }
  }
  return openViaHttp(options);
}

function openViaWebSocket(options: OpenOptions): Promise<LiveConnection> {
  const { scenarioId, onReady, onEvent, onTransportLost } = options;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(liveWsUrl());
    let settled = false;
    let intentionalClose = false;
    let sessionId: string | null = null;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(err);
    };

    const timer = window.setTimeout(() => {
      fail(new Error("Live WebSocket timed out"));
    }, 20_000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "start", scenarioId }));
    };

    ws.onmessage = (ev) => {
      let data: (LiveBridgeEvent | LiveReadyPayload) & { type: string };
      try {
        data = JSON.parse(String(ev.data)) as (LiveBridgeEvent | LiveReadyPayload) & {
          type: string;
        };
      } catch {
        return;
      }

      if (data.type === "ready") {
        const ready = data as LiveReadyPayload & { type: "ready" };
        if (!ready.sessionId) {
          fail(new Error("Live session missing id"));
          return;
        }
        sessionId = ready.sessionId;
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          onReady?.(ready);
          resolve({
            sessionId: ready.sessionId,
            practiceSessionId: ready.practiceSessionId,
            sendAudio: (audio) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              ws.send(JSON.stringify({ type: "audio", audio }));
            },
            close: () => {
              intentionalClose = true;
              if (ws.readyState === WebSocket.OPEN) {
                try {
                  ws.send(JSON.stringify({ type: "end" }));
                } catch {
                  /* ignore */
                }
              }
              try {
                ws.close();
              } catch {
                /* ignore */
              }
            },
          });
        }
        return;
      }

      if (data.type === "error") {
        const message =
          "message" in data && typeof data.message === "string"
            ? data.message
            : "Live error";
        if (!settled) {
          fail(new Error(message));
          return;
        }
        onEvent({ type: "error", message });
        return;
      }

      if (!settled) return;
      onEvent(data as LiveBridgeEvent);
    };

    ws.onerror = () => {
      if (!settled) fail(new Error("Live WebSocket failed"));
    };

    ws.onclose = () => {
      window.clearTimeout(timer);
      if (!settled) {
        fail(new Error("Live WebSocket closed before ready"));
        return;
      }
      if (!intentionalClose && sessionId) {
        onTransportLost();
      }
    };
  });
}

async function openViaHttp(options: OpenOptions): Promise<LiveConnection> {
  const { scenarioId, onReady, onEvent, onTransportLost } = options;

  const createRes = await fetch("/api/live/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId }),
  });
  const created = (await createRes.json()) as LiveReadyPayload & {
    error?: string;
  };
  if (!createRes.ok || !created.sessionId) {
    throw new Error(
      created.error ?? "Could not start the voice session — try again",
    );
  }

  const boundSessionId = created.sessionId;
  onReady?.(created);

  const es = new EventSource(`/api/live/session/${boundSessionId}`);
  let intentionalClose = false;

  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as LiveBridgeEvent | {
        type: "subscribed";
      };
      onEvent(data);
    } catch (err) {
      console.error("[session] bad live event", err);
    }
  };
  es.onerror = () => {
    if (intentionalClose) return;
    onTransportLost();
  };

  return {
    sessionId: boundSessionId,
    practiceSessionId: created.practiceSessionId,
    sendAudio: (audio) => {
      void fetch(`/api/live/session/${boundSessionId}/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio }),
      }).catch(() => {
        /* session may be closing */
      });
    },
    close: () => {
      intentionalClose = true;
      es.close();
      void fetch(`/api/live/session/${boundSessionId}`, { method: "DELETE" });
    },
  };
}
