import { NextResponse } from "next/server";
import {
  isRequireUserError,
  requireUser,
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
export const maxDuration = 300;

/**
 * Single long-lived HTTP request: NDJSON uplink + SSE downlink.
 * Same protocol as /api/live/ws — for duplex clients / WS fallbacks.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (isRequireUserError(auth)) return auth.error;

  if (!req.body) {
    return NextResponse.json({ error: "Request body required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let liveSessionId: string | null = null;
  let unsub: (() => void) | undefined;
  let closed = false;
  let started = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (msg: LiveServerMessage) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(msg)}\n\n`),
          );
        } catch {
          /* stream closed */
        }
      };

      const cleanup = async () => {
        if (closed) return;
        closed = true;
        const id = liveSessionId;
        const sub = unsub;
        liveSessionId = null;
        unsub = undefined;
        await cleanupLivePracticeSession(auth, id, sub, "[live/stream]");
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      const handleLine = async (line: string) => {
        if (!line.trim() || closed) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(line) as unknown;
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
          return;
        }

        if (msg.type === "start") {
          if (started) return;
          started = true;
          await startLivePracticeSession(auth, msg.scenarioId, {
            logPrefix: "[live/stream]",
            send,
            setSession: (sessionId, nextUnsub) => {
              liveSessionId = sessionId;
              unsub = nextUnsub;
            },
            onBridgeClosed: () => {
              void cleanup();
            },
          });
          return;
        }

        if (msg.type === "audio") {
          forwardLiveAudio(auth, liveSessionId, msg.audio, send);
        }
      };

      void (async () => {
        const reader = req.body!.getReader();
        let buffer = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              await handleLine(line);
              if (closed) return;
            }
          }
          if (buffer.trim()) await handleLine(buffer);
        } catch (err) {
          if (!closed) {
            console.error("[live/stream] uplink", err);
          }
        } finally {
          await cleanup();
        }
      })();

      req.signal.addEventListener("abort", () => {
        void cleanup();
      });
    },
    cancel() {
      closed = true;
      const id = liveSessionId;
      const sub = unsub;
      liveSessionId = null;
      unsub = undefined;
      void cleanupLivePracticeSession(auth, id, sub, "[live/stream]");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
