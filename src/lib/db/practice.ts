import type { CoachMode, CoachResponse } from "@/lib/coach/schema";
import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function createPracticeSession(
  supabase: Supabase,
  input: {
    userId: string;
    liveSessionId: string;
    scenarioId: string;
    titleKo: string;
    titleEn: string;
  },
) {
  const { data, error } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: input.userId,
      live_session_id: input.liveSessionId,
      scenario_id: input.scenarioId,
      title_ko: input.titleKo,
      title_en: input.titleEn,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function endPracticeSession(
  supabase: Supabase,
  input: { userId: string; liveSessionId: string },
) {
  const { error } = await supabase
    .from("practice_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("live_session_id", input.liveSessionId)
    .eq("user_id", input.userId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
}

export async function persistCoachTurn(
  supabase: Supabase,
  input: {
    userId: string;
    practiceSessionId: string;
    clientTurnId?: string;
    mode: CoachMode;
    transcript: string;
    result: CoachResponse;
  },
) {
  const role = input.mode === "partner_assist" ? "partner" : "user";

  const { data: owned, error: ownErr } = await supabase
    .from("practice_sessions")
    .select("id")
    .eq("id", input.practiceSessionId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (ownErr) throw new Error(ownErr.message);
  if (!owned) throw new Error("Practice session not found");

  const { data: turn, error: turnErr } = await supabase
    .from("turns")
    .insert({
      practice_session_id: input.practiceSessionId,
      client_turn_id: input.clientTurnId ?? null,
      role,
      transcript: input.transcript,
    })
    .select("id")
    .single();

  if (turnErr) throw new Error(turnErr.message);

  const { error: coachErr } = await supabase.from("coach_results").insert({
    turn_id: turn.id,
    practice_session_id: input.practiceSessionId,
    mode: input.mode,
    payload: input.result as unknown as Json,
  });

  if (coachErr) throw new Error(coachErr.message);
}

export async function listPracticeSessions(
  supabase: Supabase,
  userId: string,
  limit = 20,
) {
  const { data, error } = await supabase
    .from("practice_sessions")
    .select("id, scenario_id, title_ko, title_en, status, started_at, ended_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}
