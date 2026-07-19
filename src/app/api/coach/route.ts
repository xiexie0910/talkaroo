import { NextResponse } from "next/server";
import { isRequireUserError, requireUser } from "@/lib/auth/requireUser";
import {
  type CoachApiResult,
  type CoachMode,
  coachRequestSchema,
  emptyLearnerImprove,
  emptyPartnerAssist,
  safeParseCoachResponse,
} from "@/lib/coach/schema";
import { coachJsonSchemaForMode } from "@/lib/coach/jsonSchema";
import { persistCoachTurn } from "@/lib/db/practice";
import { requireGoogleCloudProject } from "@/lib/env/server";
import { createGenAIClient } from "@/lib/gemini/client";
import { COACH_MODEL } from "@/lib/gemini/models";
import { takeToken } from "@/lib/rateLimit";
import { shouldRunCoach } from "@/lib/session/level";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Per-attempt budget — Vertex structured JSON often needs >8s. */
const COACH_TIMEOUT_MS = Number(
  process.env.COACH_TIMEOUT_MS?.trim() || "25000",
);
const MAX_TRANSCRIPT_CHARS = 500;
const MAX_CONTEXT_CHARS = 400;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

const PARTNER_ASSIST_SYSTEM = `Korean learning aide. Analyze ONE partner line. Return JSON only.

Rules:
- mode: "partner_assist"
- partner_sentence: cleaned Hangul
- translation_en: short natural English
- vocab: up to 3 useful words/phrases (skip ultra-basic particles). note: ≤8 English words or ""
- suggested_replies: exactly 2 polite Korean (해요체) reply ideas with en gloss; pattern may be ""
- Empty/unintelligible line → empty strings and empty arrays`;

const LEARNER_IMPROVE_SYSTEM = `Korean learning aide. Improve ONE learner utterance (ASR may be messy). Return JSON only.

Rules:
- mode: "learner_improve"
- user_sentence: as given
- natural_ko: one natural 해요체 rewrite, or "" if garbage/non-Korean
- tip_en: 1 short English tip (not a lecture)
- was_already_natural: true if tiny/no change
- Use partner context when provided
- Garbage/English → natural_ko "", tip asking for a short Korean sentence`;

function systemForMode(mode: CoachMode): string {
  return mode === "partner_assist"
    ? PARTNER_ASSIST_SYSTEM
    : LEARNER_IMPROVE_SYSTEM;
}

async function callCoachOnce(
  mode: CoachMode,
  transcript: string,
  context: string | undefined,
  stricter: boolean,
  signal: AbortSignal,
): Promise<unknown> {
  const client = createGenAIClient();
  const contextBlock = context
    ? `\nPartner context: ${JSON.stringify(context)}`
    : "";

  const task =
    mode === "partner_assist"
      ? "Analyze partner line"
      : "Improve learner utterance";

  const userPrompt = stricter
    ? `JSON only. mode="${mode}". ${task}:\n${JSON.stringify(transcript)}${contextBlock}`
    : `${task}:\n${JSON.stringify(transcript)}${contextBlock}`;

  const response = await client.models.generateContent({
    model: COACH_MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: systemForMode(mode),
      responseMimeType: "application/json",
      responseJsonSchema: coachJsonSchemaForMode(mode),
      abortSignal: signal,
      // Prefer speed for on-tap coaching during a live session.
      temperature: 0.4,
    },
  });

  const text = response.text?.trim() ?? "";
  if (!text) throw new Error("Empty coach response");

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned) as unknown;
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (isRequireUserError(auth)) {
    return NextResponse.json(
      { error: true, message: "Sign in required" } satisfies CoachApiResult,
      { status: 401 },
    );
  }

  try {
    requireGoogleCloudProject();
  } catch {
    return NextResponse.json(
      {
        error: true,
        message: "GOOGLE_CLOUD_PROJECT is not configured",
      } satisfies CoachApiResult,
      { status: 500 },
    );
  }

  // Key on userId only — X-Forwarded-For is spoofable and must not mint new buckets.
  if (!takeToken(`coach:${auth.user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      {
        error: true,
        message: "Too many coach requests — try again shortly",
      } satisfies CoachApiResult,
      { status: 429 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: true, message: "Invalid JSON body" } satisfies CoachApiResult,
      { status: 400 },
    );
  }

  const parsed = coachRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: true,
        message:
          'Need mode ("partner_assist"|"learner_improve") and level (beginner|intermediate|advanced)',
      } satisfies CoachApiResult,
      { status: 400 },
    );
  }
  const body = parsed.data;
  const mode = body.mode;

  if (!shouldRunCoach(body.level, mode)) {
    return NextResponse.json(
      {
        error: true,
        message: `Coach mode "${mode}" is not available at ${body.level} level`,
      } satisfies CoachApiResult,
      { status: 403 },
    );
  }

  const transcript = (body.transcript ?? "")
    .trim()
    .slice(0, MAX_TRANSCRIPT_CHARS);
  const context =
    (body.context ?? "").trim().slice(0, MAX_CONTEXT_CHARS) || undefined;

  if (!transcript) {
    return NextResponse.json(
      (mode === "partner_assist"
        ? emptyPartnerAssist()
        : emptyLearnerImprove()) satisfies CoachApiResult,
    );
  }

  // Two attempts must fit under route maxDuration (60s).
  const timeoutMs = Number.isFinite(COACH_TIMEOUT_MS)
    ? Math.min(28_000, Math.max(10_000, COACH_TIMEOUT_MS))
    : 25_000;

  let lastError = "Coach failed";

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const raw = await callCoachOnce(
        mode,
        transcript,
        context,
        attempt > 0,
        controller.signal,
      );
      const parsed = safeParseCoachResponse(raw);
      if (parsed.success) {
        if (parsed.data.mode !== mode) {
          lastError = `Coach returned mode ${parsed.data.mode}, expected ${mode}`;
        } else {
          const practiceSessionId = body.practiceSessionId?.trim();
          // Don't block the client on DB write — coaching latency is what they feel.
          if (practiceSessionId) {
            void persistCoachTurn(auth.supabase, {
              userId: auth.user.id,
              practiceSessionId,
              clientTurnId: body.turnId,
              mode,
              transcript,
              result: parsed.data,
            }).catch((persistErr) => {
              console.error("[coach persist]", persistErr);
            });
          }
          return NextResponse.json(parsed.data satisfies CoachApiResult);
        }
      } else {
        lastError = parsed.error.message;
      }
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const message = err instanceof Error ? err.message : "Coach failed";
      lastError =
        name === "AbortError" || /aborted|timeout/i.test(message)
          ? "Coach timed out — tap Retry"
          : message;
    } finally {
      clearTimeout(timer);
    }
  }

  return NextResponse.json(
    { error: true, message: lastError } satisfies CoachApiResult,
    { status: 422 },
  );
}
