/** JSON Schema for Gemini post-session recap structured output. */

export const sessionRecapJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["win", "focus", "nextMission"],
  properties: {
    win: { type: "string", minLength: 1, maxLength: 280 },
    focus: {
      type: "object",
      additionalProperties: false,
      required: ["korean", "english", "reason"],
      properties: {
        korean: { type: "string", minLength: 1, maxLength: 120 },
        english: { type: "string", minLength: 1, maxLength: 160 },
        reason: { type: "string", minLength: 1, maxLength: 200 },
      },
    },
    nextMission: {
      type: "object",
      additionalProperties: false,
      required: ["scenarioId", "objective", "starterPhrase"],
      properties: {
        scenarioId: {
          type: "string",
          enum: ["daily-chat", "cafe-order", "restaurant", "directions"],
        },
        objective: { type: "string", minLength: 1, maxLength: 240 },
        starterPhrase: { type: "string", minLength: 1, maxLength: 120 },
      },
    },
  },
} as const;
