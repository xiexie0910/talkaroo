/** Hangul syllables (가–힣). */
const HANGUL_RE = /[\uAC00-\uD7A3]/;

/** True if the string contains at least one Hangul syllable. */
export function hasHangul(text: string): boolean {
  return HANGUL_RE.test(text);
}

/**
 * Strip common ASR junk when the mic hears noise / unclear speech
 * (e.g. "{Rolle}", "{}", "[music]", "<unk>").
 */
export function sanitizeLearnerTranscript(text: string): string {
  return text
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[{}[\]<>|_]+/g, " ")
    .replace(
      /\b(inaudible|unintelligible|music|noise|applause|laughter|silence)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether cleaned learner text is worth showing in the chat bubble.
 * Requires Hangul after stripping ASR artifacts.
 */
export function isDisplayableLearnerTranscript(text: string): boolean {
  const cleaned = sanitizeLearnerTranscript(text);
  if (cleaned.length < 1) return false;
  return hasHangul(cleaned);
}

/**
 * Whether a learner transcript is worth sending to the coach.
 * Filters ASR garbage like "{Rolle} {Rolle} X" that has no Korean.
 */
export function isCoachableLearnerTranscript(text: string): boolean {
  return isDisplayableLearnerTranscript(text);
}

/** Collapse whitespace / light punctuation for continuation checks. */
function normalizeTranscript(text: string): string {
  return text.trim().replace(/\s+/g, "").replace(/[.,!?…~·]/g, "");
}

/**
 * True when the learner likely repeated themselves while waiting for the
 * bubble to appear (same / nearly-same utterance).
 */
export function isNearDuplicateUtterance(a: string, b: string): boolean {
  const left = normalizeTranscript(sanitizeLearnerTranscript(a));
  const right = normalizeTranscript(sanitizeLearnerTranscript(b));
  if (!left || !right) return false;
  if (left === right) return true;
  // One is a short prefix/suffix of the other (partial ASR of the same line).
  const [shorter, longer] =
    left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length < 2) return false;
  if (longer.startsWith(shorter) || longer.endsWith(shorter)) {
    // Avoid treating "없어요" as a dup of a long unrelated sentence.
    return shorter.length / longer.length >= 0.55;
  }
  return false;
}

/**
 * True when `incoming` is the same partner/user utterance continuing past
 * `previous` (common when Live seals early, then sends a longer cumulative ASR).
 */
export function isTranscriptContinuation(
  previous: string,
  incoming: string,
): boolean {
  const prev = previous.trim();
  const next = incoming.trim();
  if (!prev || !next) return false;
  if (next === prev) return true;
  if (next.startsWith(prev)) return true;
  const p = normalizeTranscript(prev);
  const n = normalizeTranscript(next);
  if (!p || !n) return false;
  if (n === p || n.startsWith(p)) return true;
  // Short interim rewind of the same line
  if (p.startsWith(n) && n.length >= Math.min(2, p.length)) return true;
  return false;
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
  if (isTranscriptContinuation(previous, incoming)) {
    return incoming.trim().length >= previous.trim().length
      ? incoming
      : previous;
  }
  return previous + incoming;
}
