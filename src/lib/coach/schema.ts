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

/** Speech level of the learner line (or of the suggested rewrite). */
export const formalitySchema = z.enum([
  "banmal",
  "haeyo",
  "hapsyo",
  "mixed",
  "unclear",
]);
export type Formality = z.infer<typeof formalitySchema>;

/** Whether that speech level fits the partner/scene context. */
export const formalityFitSchema = z.enum([
  "fits",
  "too_casual",
  "too_formal",
  "n_a",
]);
export type FormalityFit = z.infer<typeof formalityFitSchema>;

const tipItemSchema = z.string().min(1).max(200);

export const learnerImproveSchema = z.object({
  mode: z.literal("learner_improve"),
  /** Raw ASR / as given. */
  user_sentence: z.string(),
  /** Cleaned Hangul of what they said (or best guess). */
  heard_as_ko: z.string(),
  /**
   * What they were trying to communicate (intent), in plain English —
   * not a literal gloss of wrong/ASR words.
   */
  meant_en: z.string(),
  /** One natural native-sounding rewrite for this moment. */
  natural_ko: z.string(),
  /** Short English gloss of natural_ko. */
  natural_en: z.string(),
  /** Speech level of their line (or of natural_ko if theirs was unclear). */
  formality: formalitySchema,
  formality_fit: formalityFitSchema,
  /**
   * Distinct coaching bullets: meaning/ASR fixes, naturalness, formality.
   * No duplicate points across bullets.
   */
  tips_en: z.array(tipItemSchema).max(4),
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
    heard_as_ko: "",
    meant_en: "",
    natural_ko: "",
    natural_en: "",
    formality: "unclear",
    formality_fit: "n_a",
    tips_en: [
      tip ??
        "Couldn't catch clear Korean — try saying a short sentence in Korean.",
    ],
    was_already_natural: false,
  };
}
