/** JSON Schema for Gemini coach structured output (Learning HUD). */

export const partnerAssistJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "mode",
    "partner_sentence",
    "translation_en",
    "vocab",
    "suggested_replies",
  ],
  properties: {
    mode: { type: "string", enum: ["partner_assist"] },
    partner_sentence: { type: "string" },
    translation_en: { type: "string" },
    vocab: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["surface", "meaning_en", "note"],
        properties: {
          surface: { type: "string", minLength: 1 },
          meaning_en: { type: "string", minLength: 1 },
          note: { type: "string", maxLength: 80 },
        },
      },
    },
    suggested_replies: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ko", "en", "pattern"],
        properties: {
          ko: { type: "string", minLength: 1 },
          en: { type: "string", minLength: 1 },
          pattern: { type: "string", maxLength: 80 },
        },
      },
    },
  },
} as const;

export const learnerImproveJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "mode",
    "user_sentence",
    "heard_as_ko",
    "meant_en",
    "natural_ko",
    "natural_en",
    "formality",
    "formality_fit",
    "tips_en",
    "was_already_natural",
  ],
  properties: {
    mode: { type: "string", enum: ["learner_improve"] },
    user_sentence: { type: "string" },
    heard_as_ko: { type: "string" },
    meant_en: { type: "string" },
    natural_ko: { type: "string" },
    natural_en: { type: "string" },
    formality: {
      type: "string",
      enum: ["banmal", "haeyo", "hapsyo", "mixed", "unclear"],
    },
    formality_fit: {
      type: "string",
      enum: ["fits", "too_casual", "too_formal", "n_a"],
    },
    tips_en: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 200 },
    },
    was_already_natural: { type: "boolean" },
  },
} as const;

export function coachJsonSchemaForMode(
  mode: "partner_assist" | "learner_improve",
) {
  return mode === "partner_assist"
    ? partnerAssistJsonSchema
    : learnerImproveJsonSchema;
}
