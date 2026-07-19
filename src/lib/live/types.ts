/** Shared Live bridge event types (safe for client + server). */

export type LiveBridgeEvent =
  | { type: "open" }
  | { type: "audio"; data: string }
  | { type: "output_transcription"; text: string }
  | {
      type: "input_transcription";
      text: string;
      /** replace = interim snapshot while speaking; append = committed delta */
      mode: "replace" | "append";
    }
  /** Model generation cut short (barge-in) — client must flush the audio queue. */
  | { type: "interrupted" }
  | { type: "turn_complete" }
  | { type: "error"; message: string }
  | { type: "closed" };
