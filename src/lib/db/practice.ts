import type { CoachMode, CoachResponse } from "@/lib/coach/schema";
import type { SessionRecap } from "@/lib/recap/schema";
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
  input:
    | { userId: string; liveSessionId: string }
    | { userId: string; practiceSessionId: string },
) {
  let query = supabase
    .from("practice_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("status", "active");

  if ("liveSessionId" in input) {
    query = query.eq("live_session_id", input.liveSessionId);
  } else {
    query = query.eq("id", input.practiceSessionId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function getPracticeSessionForUser(
  supabase: Supabase,
  input: { userId: string; practiceSessionId: string },
) {
  const { data, error } = await supabase
    .from("practice_sessions")
    .select(
      "id, user_id, live_session_id, scenario_id, title_ko, title_en, status, started_at, ended_at",
    )
    .eq("id", input.practiceSessionId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getSessionSummary(
  supabase: Supabase,
  practiceSessionId: string,
) {
  const { data, error } = await supabase
    .from("practice_session_summaries")
    .select("practice_session_id, recap, next_scenario_id, created_at")
    .eq("practice_session_id", practiceSessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function saveSessionSummary(
  supabase: Supabase,
  input: {
    practiceSessionId: string;
    recap: SessionRecap;
    nextScenarioId: string;
  },
) {
  const { data, error } = await supabase
    .from("practice_session_summaries")
    .insert({
      practice_session_id: input.practiceSessionId,
      recap: input.recap as unknown as Json,
      next_scenario_id: input.nextScenarioId,
    })
    .select("practice_session_id, recap, next_scenario_id, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
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

