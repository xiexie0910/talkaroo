import { z } from "zod";

/** Scenario ids allowed in next-mission suggestions (catalog only). */
export const recapScenarioIdSchema = z.enum([
  "daily-chat",
  "cafe-order",
  "restaurant",
  "directions",
]);
export type RecapScenarioId = z.infer<typeof recapScenarioIdSchema>;

export const sessionRecapSchema = z.object({
  win: z.string().min(1).max(280),
  focus: z.object({
    korean: z.string().min(1).max(120),
    english: z.string().min(1).max(160),
    reason: z.string().min(1).max(200),
  }),
  nextMission: z.object({
    scenarioId: recapScenarioIdSchema,
    objective: z.string().min(1).max(240),
    starterPhrase: z.string().min(1).max(120),
  }),
});

export type SessionRecap = z.infer<typeof sessionRecapSchema>;

export const transcriptLineSchema = z.object({
  role: z.enum(["user", "partner"]),
  text: z.string().min(1).max(500),
});

export const completeSessionRequestSchema = z.object({
  transcript: z.array(transcriptLineSchema).max(80),
});

export type CompleteSessionRequest = z.infer<
  typeof completeSessionRequestSchema
>;

export type CompleteSessionSuccess = {
  error?: false;
  recap: SessionRecap;
  fallback?: boolean;
};

export type CompleteSessionError = { error: true; message: string };
export type CompleteSessionResult =
  | CompleteSessionSuccess
  | CompleteSessionError;

export function safeParseSessionRecap(data: unknown) {
  return sessionRecapSchema.safeParse(data);
}

export function parseSessionRecapFromJson(data: unknown): SessionRecap | null {
  const parsed = sessionRecapSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Graceful recap when generation fails — still ends the session. */
export function genericFallbackRecap(
  scenarioId?: string | null,
): SessionRecap {
  const nextId = recapScenarioIdSchema.safeParse(scenarioId).success
    ? (scenarioId as RecapScenarioId)
    : "cafe-order";

  const missions: Record<
    RecapScenarioId,
    { objective: string; starterPhrase: string }
  > = {
    "daily-chat": {
      objective: "In daily chat, say how your day was in one short sentence.",
      starterPhrase: "오늘 하루 어땠어요?",
    },
    "cafe-order": {
      objective: "At the café, order one drink and say if it is to go.",
      starterPhrase: "아이스 아메리카노 주세요.",
    },
    restaurant: {
      objective: "At a restaurant, ask for a table for two and order one dish.",
      starterPhrase: "두 명이에요.",
    },
    directions: {
      objective: "Ask how to get to the subway station nearby.",
      starterPhrase: "지하철역이 어디에 있어요?",
    },
  };

  const mission = missions[nextId];

  return {
    win: "You showed up and practiced speaking Korean — that counts.",
    focus: {
      korean: mission.starterPhrase,
      english: "A useful starter for your next scene.",
      reason: "Keep the next practice short and concrete.",
    },
    nextMission: {
      scenarioId: nextId,
      objective: mission.objective,
      starterPhrase: mission.starterPhrase,
    },
  };
}
