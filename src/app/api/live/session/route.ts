import { NextResponse } from "next/server";
import { isRequireUserError, requireUser } from "@/lib/auth/requireUser";
import { createPracticeSession } from "@/lib/db/practice";
import { createLiveBridgeSession, closeLiveBridge } from "@/lib/live/bridge";
import { takeToken } from "@/lib/rateLimit";
import { getScenario, scenarioById } from "@/lib/scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIVE_CREATE_LIMIT = 8;
const LIVE_CREATE_WINDOW_MS = 60_000;

/** Start a server-side Vertex Live session (ADC). Browser never sees cloud credentials. */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (isRequireUserError(auth)) return auth.error;

  if (
    !takeToken(
      `live-create:${auth.user.id}`,
      LIVE_CREATE_LIMIT,
      LIVE_CREATE_WINDOW_MS,
    )
  ) {
    return NextResponse.json(
      { error: "Too many Live sessions — try again shortly" },
      { status: 429 },
    );
  }

  let liveSessionId: string | null = null;

  try {
    let scenarioId: string | undefined;
    try {
      const body = (await req.json()) as { scenarioId?: string };
      if (body.scenarioId != null && typeof body.scenarioId !== "string") {
        return NextResponse.json(
          { error: "scenarioId must be a string" },
          { status: 400 },
        );
      }
      scenarioId = body.scenarioId?.trim() || undefined;
    } catch {
      /* empty body OK */
    }

    if (scenarioId && !scenarioById[scenarioId]) {
      return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
    }

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

    return NextResponse.json({
      sessionId,
      practiceSessionId,
      model,
      scenarioId: scenario.id,
      starterLine: scenario.starterLine,
      titleKo: scenario.titleKo,
      titleEn: scenario.titleEn,
    });
  } catch (err) {
    if (liveSessionId) closeLiveBridge(liveSessionId, auth.user.id);
    console.error("[live/session]", err);
    return NextResponse.json(
      { error: "Failed to start Live session" },
      { status: 502 },
    );
  }
}
