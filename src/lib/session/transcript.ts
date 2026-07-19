/** Hangul syllables (가–힣). */
const HANGUL_RE = /[\uAC00-\uD7A3]/;

/** True if the string contains at least one Hangul syllable. */
export function hasHangul(text: string): boolean {
  return HANGUL_RE.test(text);
}

/**
 * Whether a learner transcript is worth sending to the coach.
 * Filters ASR garbage like "{Rolle} {Rolle} X" that has no Korean.
 */
export function isCoachableLearnerTranscript(text: string): boolean {
  const t = text.trim();
  if (t.length < 1) return false;
  return hasHangul(t);
}

/**
 * Merge Live ASR chunks. Interim snapshots replace; committed chunks may be
 * deltas or cumulative — avoid duplicating when both arrive.
 */
export function mergeTranscriptChunk(
  previous: string,
  incoming: string,
  mode: "replace" | "append",
): string {
  if (mode === "replace") return incoming;
  if (!previous) return incoming;
  if (!incoming) return previous;
  if (incoming.startsWith(previous)) return incoming;
  if (previous.startsWith(incoming)) return previous;
  if (previous.endsWith(incoming)) return previous;
  return previous + incoming;
}
