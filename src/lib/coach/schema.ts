import { z } from "zod";
import { learnerLevelSchema } from "@/lib/scenarios/types";

export const coachModeSchema = z.enum(["partner_assist", "learner_improve"]);
export type CoachMode = z.infer<typeof coachModeSchema>;

/** Soft max lengths for Zod + post-model clamping (Vertex may ignore JSON Schema maxLength). */
export const COACH_TIP_MAX_CHARS = 200;
export const COACH_STRING_SOFT_MAX = 500;
export const COACH_NOTE_MAX_CHARS = 80;
export const COACH_VOCAB_SURFACE_MAX = 80;
export const COACH_VOCAB_MEANING_MAX = 120;
export const COACH_REPLY_MAX_CHARS = 200;
export const COACH_TIPS_MAX_ITEMS = 4;

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
  .max(COACH_NOTE_MAX_CHARS)
  .optional()
  .transform((v) => (v && v.trim() ? v : undefined));

export const vocabItemSchema = z.object({
  surface: z.string().min(1).max(COACH_VOCAB_SURFACE_MAX),
  meaning_en: z.string().min(1).max(COACH_VOCAB_MEANING_MAX),
  /** Empty string means no note (Structured Outputs requires the field). */
  note: optionalNote,
});

export const suggestedReplySchema = z.object({
  ko: z.string().min(1).max(COACH_REPLY_MAX_CHARS),
  en: z.string().min(1).max(COACH_REPLY_MAX_CHARS),
  pattern: optionalNote,
});

export const partnerAssistSchema = z.object({
  mode: z.literal("partner_assist"),
  partner_sentence: z.string().max(COACH_STRING_SOFT_MAX),
  translation_en: z.string().max(COACH_STRING_SOFT_MAX),
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

const tipItemSchema = z.string().min(1).max(COACH_TIP_MAX_CHARS);

function clampStr(value: unknown, max: number): string | unknown {
  if (typeof value !== "string") return value;
  const t = value.trim();
  if (t.length <= max) return t;
  // Prefer a clean cut at a sentence/word boundary when possible.
  const sliced = t.slice(0, max - 1);
  const breakAt = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
    sliced.lastIndexOf("; "),
    sliced.lastIndexOf(", "),
    sliced.lastIndexOf(" "),
  );
  if (breakAt >= Math.floor(max * 0.55)) {
    return `${sliced.slice(0, breakAt + 1).trimEnd()}…`;
  }
  return `${sliced.trimEnd()}…`;
}

/**
 * Clamp model output to schema limits before Zod parse.
 * Structured Outputs maxLength is not always enforced by Vertex.
 */
export function normalizeCoachPayload(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const obj = { ...(data as Record<string, unknown>) };

  if (obj.mode === "learner_improve") {
    for (const key of [
      "user_sentence",
      "heard_as_ko",
      "meant_en",
      "natural_ko",
      "natural_en",
    ] as const) {
      obj[key] = clampStr(obj[key], COACH_STRING_SOFT_MAX);
    }
    if (Array.isArray(obj.tips_en)) {
      obj.tips_en = obj.tips_en
        .map((tip) => clampStr(tip, COACH_TIP_MAX_CHARS))
        .filter((tip) => typeof tip === "string" && tip.length > 0)
        .slice(0, COACH_TIPS_MAX_ITEMS);
    }
  }

  if (obj.mode === "partner_assist") {
    obj.partner_sentence = clampStr(obj.partner_sentence, COACH_STRING_SOFT_MAX);
    obj.translation_en = clampStr(obj.translation_en, COACH_STRING_SOFT_MAX);
    if (Array.isArray(obj.vocab)) {
      obj.vocab = obj.vocab.slice(0, 3).map((item) => {
        if (!item || typeof item !== "object") return item;
        const v = { ...(item as Record<string, unknown>) };
        v.surface = clampStr(v.surface, COACH_VOCAB_SURFACE_MAX);
        v.meaning_en = clampStr(v.meaning_en, COACH_VOCAB_MEANING_MAX);
        v.note = clampStr(v.note, COACH_NOTE_MAX_CHARS);
        return v;
      });
    }
    if (Array.isArray(obj.suggested_replies)) {
      obj.suggested_replies = obj.suggested_replies.slice(0, 2).map((item) => {
        if (!item || typeof item !== "object") return item;
        const r = { ...(item as Record<string, unknown>) };
        r.ko = clampStr(r.ko, COACH_REPLY_MAX_CHARS);
        r.en = clampStr(r.en, COACH_REPLY_MAX_CHARS);
        r.pattern = clampStr(r.pattern, COACH_NOTE_MAX_CHARS);
        return r;
      });
    }
  }

  return obj;
}

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
  tips_en: z.array(tipItemSchema).max(COACH_TIPS_MAX_ITEMS),
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
