import { isRequireUserError, requireUser } from "@/lib/auth/requireUser";
import { endPracticeSession } from "@/lib/db/practice";
import { closeLiveBridge, subscribeLiveBridge } from "@/lib/live/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** SSE stream of Live events for one session. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireUser();
  if (isRequireUserError(auth)) return auth.error;

  const { id } = await params;
  const encoder = new TextEncoder();

  let unsub: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        unsub = subscribeLiveBridge(
          id,
          (event) => {
            send(event);
            if (event.type === "closed") {
              cleanup();
              try {
                controller.close();
              } catch {
                /* ignore */
              }
            }
          },
          auth.user.id,
        );
        send({ type: "subscribed" });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Subscribe failed",
        });
        controller.close();
        return;
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  function cleanup() {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    unsub?.();
    unsub = undefined;
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireUser();
  if (isRequireUserError(auth)) return auth.error;

  const { id } = await params;
  closeLiveBridge(id, auth.user.id);

  try {
    await endPracticeSession(auth.supabase, {
      userId: auth.user.id,
      liveSessionId: id,
    });
  } catch (err) {
    console.error("[live/session DELETE]", err);
  }

  return new Response(null, { status: 204 });
}
