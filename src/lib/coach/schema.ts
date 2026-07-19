import { z } from "zod";
import { learnerLevelSchema } from "@/lib/scenarios/types";

export const coachModeSchema = z.enum(["partner_assist", "learner_improve"]);
export type CoachMode = z.infer<typeof coachModeSchema>;

/** Request body for POST /api/coach (lengths clamped again in the route). */
export const coachRequestSchema = z.object({
  mode: coachModeSchema,
  /** Required so the server can enforce level affordances (not just the UI). */
  level: learnerLevelSchema,
  transcript: z.string().max(2000).optional(),
  context: z.string().max(2000).optional(),
  turnId: z.string().max(128).optional(),
  practiceSessionId: z.string().max(64).optional(),
});
export type CoachRequest = z.infer<typeof coachRequestSchema>;

const optionalNote = z
  .string()
  .max(80)
  .optional()
  .transform((v) => (v && v.trim() ? v : undefined));

export const vocabItemSchema = z.object({
  surface: z.string().min(1),
  meaning_en: z.string().min(1),
  /** Empty string means no note (Structured Outputs requires the field). */
  note: optionalNote,
});

export const suggestedReplySchema = z.object({
  ko: z.string().min(1),
  en: z.string().min(1),
  pattern: optionalNote,
});

export const partnerAssistSchema = z.object({
  mode: z.literal("partner_assist"),
  partner_sentence: z.string(),
  translation_en: z.string(),
  vocab: z.array(vocabItemSchema).max(3),
  suggested_replies: z.array(suggestedReplySchema).max(2),
});

export const learnerImproveSchema = z.object({
  mode: z.literal("learner_improve"),
  user_sentence: z.string(),
  natural_ko: z.string(),
  tip_en: z.string(),
  was_already_natural: z.boolean(),
});

export const coachResponseSchema = z.discriminatedUnion("mode", [
  partnerAssistSchema,
  learnerImproveSchema,
]);

export type PartnerAssistResponse = z.infer<typeof partnerAssistSchema>;
export type LearnerImproveResponse = z.infer<typeof learnerImproveSchema>;
export type CoachResponse = z.infer<typeof coachResponseSchema>;

export type CoachApiSuccess = CoachResponse & { error?: false };
export type CoachApiError = { error: true; message: string };
export type CoachApiResult = CoachApiSuccess | CoachApiError;

export function parseCoachResponse(data: unknown): CoachResponse {
  return coachResponseSchema.parse(data);
}

export function safeParseCoachResponse(data: unknown) {
  return coachResponseSchema.safeParse(data);
}

/** Soft empty responses when transcript is missing / unusable. */
export function emptyPartnerAssist(): PartnerAssistResponse {
  return {
    mode: "partner_assist",
    partner_sentence: "",
    translation_en: "",
    vocab: [],
    suggested_replies: [],
  };
}

export function emptyLearnerImprove(tip?: string): LearnerImproveResponse {
  return {
    mode: "learner_improve",
    user_sentence: "",
    natural_ko: "",
    tip_en:
      tip ??
      "Couldn't catch clear Korean — try saying a short sentence in Korean.",
    was_already_natural: false,
  };
}
