/**
 * Model IDs for Vertex AI (ADC).
 *
 * Live: `gemini-live-2.5-flash-native-audio` is the GA low-latency native-audio
 * model on Vertex. Newer Live previews (e.g. 3.1) are not available here yet.
 *
 * Coach: `gemini-2.5-flash-lite` is the fastest structured-JSON option we
 * measured on this project (~2× faster than gemini-2.5-flash for partner_assist).
 */

/** Gemini Live speech partner (Vertex). */
export const LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL?.trim() ||
  "gemini-live-2.5-flash-native-audio";

/** On-tap coach (Understand / Polish) — prioritize latency. */
export const COACH_MODEL =
  process.env.GEMINI_COACH_MODEL?.trim() || "gemini-2.5-flash-lite";
