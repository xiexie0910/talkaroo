import { NextResponse } from "next/server";
import { isRequireUserError, requireUser } from "@/lib/auth/requireUser";
import { sendLiveAudio } from "@/lib/live/bridge";
import { takeToken } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** ~48KB decoded — well above one ScriptProcessor PCM frame. */
const MAX_AUDIO_B64_CHARS = 64_000;
/** Mic posts ~ every 256ms; allow burst headroom. */
const AUDIO_RATE_LIMIT = 120;
const AUDIO_RATE_WINDOW_MS = 10_000;

export async function POST(req: Request, { params }: Params) {
  const auth = await requireUser();
  if (isRequireUserError(auth)) return auth.error;

  const { id } = await params;
  if (!id || id.length > 80) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  if (
    !takeToken(
      `live-audio:${auth.user.id}:${id}`,
      AUDIO_RATE_LIMIT,
      AUDIO_RATE_WINDOW_MS,
    )
  ) {
    return NextResponse.json({ error: "Audio rate limited" }, { status: 429 });
  }

  try {
    const body = (await req.json()) as { audio?: unknown };
    if (typeof body.audio !== "string" || !body.audio) {
      return NextResponse.json({ error: "audio required" }, { status: 400 });
    }
    if (body.audio.length > MAX_AUDIO_B64_CHARS) {
      return NextResponse.json({ error: "audio too large" }, { status: 413 });
    }
    // Base64 alphabet only — reject garbage that would blow decode buffers.
    if (!/^[A-Za-z0-9+/]+=*$/.test(body.audio)) {
      return NextResponse.json({ error: "invalid audio encoding" }, { status: 400 });
    }

    sendLiveAudio(id, body.audio, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Live session not found" }, { status: 404 });
  }
}
