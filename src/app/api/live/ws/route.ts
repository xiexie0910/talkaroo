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
  cleanupLivePracticeSession,
  forwardLiveAudio,
  parseLiveClientMessage,
  startLivePracticeSession,
  type LiveServerMessage,
} from "@/lib/live/sessionProtocol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Keep the Live socket alive for a practice turn (Fluid / Pro limits apply). */
export const maxDuration = 300;

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
    // Local `next dev` / `next start` lack the Vercel upgrade hook.
    if (message.includes("not available in the current runtime")) {
      return NextResponse.json(
        {
          error:
            "WebSocket Live needs the Vercel runtime. Run `npm run dev:vercel`, not `npm run dev`.",
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

  const send = (msg: LiveServerMessage) => {
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
    const id = liveSessionId;
    const sub = unsub;
    liveSessionId = null;
    unsub = undefined;
    await cleanupLivePracticeSession(auth, id, sub, "[live/ws]");
  };

  const closeSocket = (code = 1000) => {
    try {
      ws.close(code);
    } catch {
      /* ignore */
    }
  };

  ws.on("message", (raw) => {
    void (async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(raw)) as unknown;
      } catch {
        send({ type: "error", message: "Invalid message" });
        return;
      }

      const msg = parseLiveClientMessage(parsed);
      if (!msg) {
        send({ type: "error", message: "Invalid message" });
        return;
      }

      if (msg.type === "end") {
        await cleanup();
        closeSocket(1000);
        return;
      }

      if (msg.type === "start") {
        if (started) return;
        started = true;

        const result = await startLivePracticeSession(auth, msg.scenarioId, {
          logPrefix: "[live/ws]",
          send,
          setSession: (sessionId, nextUnsub) => {
            liveSessionId = sessionId;
            unsub = nextUnsub;
          },
          onBridgeClosed: () => {
            void cleanup().then(() => closeSocket(1000));
          },
        });

        if (result === "rate_limited") closeSocket(1013);
        else if (result === "bad_scenario") closeSocket(1008);
        else if (result === "failed") closeSocket(1011);
        return;
      }

      if (msg.type === "audio") {
        forwardLiveAudio(auth, liveSessionId, msg.audio, send);
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
