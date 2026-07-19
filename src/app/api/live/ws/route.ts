import {
  experimental_upgradeWebSocket,
  type WebSocket,
} from "@vercel/functions";
import { NextResponse } from "next/server";
import {
  isRequireUserError,
  requireUser,
  type RequireUserOk,
} from "@/lib/auth/requireUser";
import {
  createPracticeSession,
  endPracticeSession,
} from "@/lib/db/practice";
import {
  closeLiveBridge,
  createLiveBridgeSession,
  sendLiveAudio,
  subscribeLiveBridge,
} from "@/lib/live/bridge";
import type { LiveBridgeEvent } from "@/lib/live/types";
import { takeToken } from "@/lib/rateLimit";
import { getScenario, scenarioById } from "@/lib/scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Keep the Live socket alive for a practice turn (Fluid / Pro limits apply). */
export const maxDuration = 300;

const LIVE_CREATE_LIMIT = 8;
const LIVE_CREATE_WINDOW_MS = 60_000;
const MAX_AUDIO_B64_CHARS = 64_000;
const AUDIO_RATE_LIMIT = 120;
const AUDIO_RATE_WINDOW_MS = 10_000;

type ClientMessage =
  | { type: "start"; scenarioId?: string }
  | { type: "audio"; audio: string }
  | { type: "end" };

type ServerMessage =
  | {
      type: "ready";
      sessionId: string;
      practiceSessionId: string;
      model: string;
      scenarioId: string;
      starterLine: string;
      titleKo: string;
      titleEn: string;
    }
  | LiveBridgeEvent
  | { type: "error"; message: string };

/**
 * Bidirectional Live transport for Vercel Fluid.
 * Create + mic + events stay on one pinned Function instance (HTTP split 404s).
 */
export async function GET() {
  const auth = await requireUser();
  if (isRequireUserError(auth)) return auth.error;

  try {
    return await experimental_upgradeWebSocket(
      (ws) => {
        void attachLiveSocket(ws, auth);
      },
      { maxPayload: 256 * 1024 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "WebSocket upgrade unavailable";
    // Local `next dev` / `next start` lack the Vercel upgrade hook — use HTTP Live.
    if (message.includes("not available in the current runtime")) {
      return NextResponse.json(
        {
          error:
            "WebSocket Live needs Vercel Fluid. Locally use the HTTP Live routes.",
        },
        { status: 501 },
      );
    }
    console.error("[live/ws] upgrade failed", err);
    return NextResponse.json(
      { error: "Failed to open Live WebSocket" },
      { status: 502 },
    );
  }
}

async function attachLiveSocket(ws: WebSocket, auth: RequireUserOk) {
  let liveSessionId: string | null = null;
  let unsub: (() => void) | undefined;
  let started = false;
  let closing = false;

  const send = (msg: ServerMessage) => {
    if (ws.readyState !== ws.OPEN) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket closing */
    }
  };

  const cleanup = async () => {
    if (closing) return;
    closing = true;
    unsub?.();
    unsub = undefined;
    const id = liveSessionId;
    liveSessionId = null;
    if (id) {
      closeLiveBridge(id, auth.user.id);
      try {
        await endPracticeSession(auth.supabase, {
          userId: auth.user.id,
          liveSessionId: id,
        });
      } catch (err) {
        console.error("[live/ws] end practice", err);
      }
    }
  };

  ws.on("message", (raw) => {
    void (async () => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw)) as ClientMessage;
      } catch {
        send({ type: "error", message: "Invalid message" });
        return;
      }

      if (msg.type === "end") {
        await cleanup();
        try {
          ws.close(1000);
        } catch {
          /* ignore */
        }
        return;
      }

      if (msg.type === "start") {
        if (started) return;
        started = true;

        if (
          !takeToken(
            `live-create:${auth.user.id}`,
            LIVE_CREATE_LIMIT,
            LIVE_CREATE_WINDOW_MS,
          )
        ) {
          send({
            type: "error",
            message: "Too many Live sessions — try again shortly",
          });
          ws.close(1013);
          return;
        }

        const scenarioId = msg.scenarioId?.trim() || undefined;
        if (scenarioId && !scenarioById[scenarioId]) {
          send({ type: "error", message: "Unknown scenario" });
          ws.close(1008);
          return;
        }

        try {
          const scenario = getScenario(scenarioId);
          const { sessionId, model } = await createLiveBridgeSession(
            auth.user.id,
            scenario.id,
          );
          liveSessionId = sessionId;

          const practiceSessionId = await createPracticeSession(auth.supabase, {
            userId: auth.user.id,
            liveSessionId: sessionId,
            scenarioId: scenario.id,
            titleKo: scenario.titleKo,
            titleEn: scenario.titleEn,
          });

          unsub = subscribeLiveBridge(
            sessionId,
            (event) => {
              send(event);
              if (event.type === "closed") {
                void cleanup().then(() => {
                  try {
                    ws.close(1000);
                  } catch {
                    /* ignore */
                  }
                });
              }
            },
            auth.user.id,
          );

          send({
            type: "ready",
            sessionId,
            practiceSessionId,
            model,
            scenarioId: scenario.id,
            starterLine: scenario.starterLine,
            titleKo: scenario.titleKo,
            titleEn: scenario.titleEn,
          });
        } catch (err) {
          console.error("[live/ws] start", err);
          if (liveSessionId) {
            closeLiveBridge(liveSessionId, auth.user.id);
            liveSessionId = null;
          }
          send({ type: "error", message: "Failed to start Live session" });
          try {
            ws.close(1011);
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (msg.type === "audio") {
        if (!liveSessionId) return;
        if (typeof msg.audio !== "string" || !msg.audio) return;
        if (msg.audio.length > MAX_AUDIO_B64_CHARS) return;
        if (!/^[A-Za-z0-9+/]+=*$/.test(msg.audio)) return;
        if (
          !takeToken(
            `live-audio:${auth.user.id}:${liveSessionId}`,
            AUDIO_RATE_LIMIT,
            AUDIO_RATE_WINDOW_MS,
          )
        ) {
          return;
        }
        try {
          sendLiveAudio(liveSessionId, msg.audio, auth.user.id);
        } catch {
          send({ type: "error", message: "Live session not found" });
        }
      }
    })();
  });

  ws.on("close", () => {
    void cleanup();
  });

  ws.on("error", (err) => {
    console.error("[live/ws] socket error", err);
    void cleanup();
  });
}
