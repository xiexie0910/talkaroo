/**
 * Client Live transport.
 *
 * Prefer WebSocket everywhere (same path as production).
 * Local: run `npm run dev:vercel` so upgrades work.
 * Plain `npm run dev` falls back to split HTTP if WS is unavailable.
 */
import {
  parseLiveServerMessage,
  type LiveReadyPayload,
} from "@/lib/live/clientMessages";
import type { LiveBridgeEvent } from "@/lib/live/types";
import {
  isLocalHostname,
  resolveLiveTransportMode,
} from "@/lib/live/transportMode";

export type { LiveReadyPayload };

export type LiveConnection = {
  sessionId: string;
  practiceSessionId?: string;
  sendAudio: (base64Pcm: string) => void;
  close: () => void;
};

type OpenOptions = {
  scenarioId: string;
  onReady?: (ready: LiveReadyPayload) => void;
  onEvent: (event: LiveBridgeEvent | { type: "subscribed" }) => void;
  onTransportLost: () => void;
};

function supportsDuplexFetch(): boolean {
  try {
    void new Request("http://127.0.0.1", {
      method: "POST",
      body: new ReadableStream(),
      // @ts-expect-error duplex is not in all TS DOM libs yet
      duplex: "half",
    });
    return true;
  } catch {
    return false;
  }
}

function liveWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/live/ws`;
}

function liveStreamUrl(): string {
  return `${window.location.origin}/api/live/stream`;
}

function currentTransportMode(websocketFailed = false) {
  return resolveLiveTransportMode({
    hostname: window.location.hostname,
    liveWsFlag: process.env.NEXT_PUBLIC_LIVE_WS,
    liveHttpFlag: process.env.NEXT_PUBLIC_LIVE_HTTP,
    liveDuplexFlag: process.env.NEXT_PUBLIC_LIVE_DUPLEX,
    supportsDuplexFetch: supportsDuplexFetch(),
    websocketFailed,
  });
}

export async function openLiveConnection(
  options: OpenOptions,
): Promise<LiveConnection> {
  let mode = currentTransportMode(false);

  if (mode === "websocket") {
    try {
      return await openViaWebSocket(options);
    } catch (err) {
      console.warn("[live] WebSocket failed — trying fallback transport", err);
      mode = currentTransportMode(true);
      if (mode !== "duplex" && mode !== "legacy-http") {
        throw err instanceof Error
          ? err
          : new Error("Live WebSocket unavailable");
      }
    }
  }

  if (mode === "duplex") {
    return openViaDuplexStream(options);
  }

  if (mode === "legacy-http") {
    if (!isLocalHostname(window.location.hostname)) {
      throw new Error(
        "Split HTTP Live is not safe on multi-instance hosts — use WebSocket",
      );
    }
    return openViaHttp(options);
  }

  throw new Error("Live transport unavailable");
}

type SettleOpts = {
  onReady?: (ready: LiveReadyPayload) => void;
  onEvent: OpenOptions["onEvent"];
  resolve: (conn: LiveConnection) => void;
  fail: (err: Error) => void;
  settled: () => boolean;
  markSettled: () => void;
  clearTimer: () => void;
  buildConnection: (ready: LiveReadyPayload) => LiveConnection;
};

function handleParsedServerMessage(
  data: NonNullable<ReturnType<typeof parseLiveServerMessage>>,
  opts: SettleOpts,
) {
  if (data.type === "ready") {
    if (opts.settled()) return;
    opts.markSettled();
    opts.clearTimer();
    opts.onReady?.(data);
    opts.resolve(opts.buildConnection(data));
    return;
  }

  if (data.type === "error") {
    if (!opts.settled()) {
      opts.fail(new Error(data.message));
      return;
    }
    opts.onEvent({ type: "error", message: data.message });
    return;
  }

  if (!opts.settled()) return;
  opts.onEvent(data);
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

    const settle: SettleOpts = {
      onReady,
      onEvent,
      resolve,
      fail,
      settled: () => settled,
      markSettled: () => {
        settled = true;
      },
      clearTimer: () => window.clearTimeout(timer),
      buildConnection: (ready) => {
        sessionId = ready.sessionId;
        return {
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
        };
      },
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "start", scenarioId }));
    };

    ws.onmessage = (ev) => {
      const data = parseLiveServerMessage(String(ev.data));
      if (!data) return;
      handleParsedServerMessage(data, settle);
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

function openViaDuplexStream(options: OpenOptions): Promise<LiveConnection> {
  const { scenarioId, onReady, onEvent, onTransportLost } = options;

  const uplink = new TransformStream<Uint8Array, Uint8Array>();
  const writer = uplink.writable.getWriter();
  const textEncoder = new TextEncoder();

  const writeLine = async (obj: unknown) => {
    await writer.write(textEncoder.encode(`${JSON.stringify(obj)}\n`));
  };

  let intentionalClose = false;
  let settled = false;
  let sessionId: string | null = null;

  return new Promise<LiveConnection>((resolve, reject) => {
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      void writer.close().catch(() => undefined);
      reject(err);
    };

    const timer = window.setTimeout(() => {
      fail(new Error("Live stream timed out"));
    }, 25_000);

    const settle: SettleOpts = {
      onReady,
      onEvent,
      resolve,
      fail,
      settled: () => settled,
      markSettled: () => {
        settled = true;
      },
      clearTimer: () => window.clearTimeout(timer),
      buildConnection: (ready) => {
        sessionId = ready.sessionId;
        return {
          sessionId: ready.sessionId,
          practiceSessionId: ready.practiceSessionId,
          sendAudio: (audio) => {
            void writeLine({ type: "audio", audio }).catch(() => undefined);
          },
          close: () => {
            intentionalClose = true;
            void writeLine({ type: "end" })
              .catch(() => undefined)
              .finally(() => {
                void writer.close().catch(() => undefined);
              });
          },
        };
      },
    };

    void (async () => {
      try {
        const resPromise = fetch(liveStreamUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/x-ndjson",
            Accept: "text/event-stream",
          },
          body: uplink.readable,
          // @ts-expect-error duplex not in all DOM typings
          duplex: "half",
        });

        await writeLine({ type: "start", scenarioId });

        const res = await resPromise;

        if (!res.ok || !res.body) {
          const errBody = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          fail(
            new Error(errBody?.error ?? `Live stream failed (${res.status})`),
          );
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const data = parseLiveServerMessage(line.slice(6));
              if (!data) continue;
              handleParsedServerMessage(data, settle);
            }
          }
        }

        if (!settled) {
          fail(new Error("Live stream closed before ready"));
          return;
        }
        if (!intentionalClose && sessionId) {
          onTransportLost();
        }
      } catch (err) {
        fail(err instanceof Error ? err : new Error("Live stream failed"));
      }
    })();
  });
}

/** Split HTTP — localhost / next dev only (multi-instance unsafe). */
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
    const data = parseLiveServerMessage(msg.data);
    if (!data || data.type === "ready") {
      if (!data) console.error("[session] bad live event");
      return;
    }
    if (data.type === "error") {
      onEvent({ type: "error", message: data.message });
      return;
    }
    onEvent(data);
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
