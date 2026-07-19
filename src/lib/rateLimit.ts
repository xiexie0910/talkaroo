/**
 * Tiny in-memory sliding window. Fine for single-instance Next.js;
 * replace with Redis/edge limits before multi-instance production.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

function pruneExpired(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Hard cap if still oversized (all active windows)
  if (buckets.size >= MAX_BUCKETS) {
    const overflow = buckets.size - Math.floor(MAX_BUCKETS * 0.8);
    let dropped = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      dropped += 1;
      if (dropped >= overflow) break;
    }
  }
}

export function takeToken(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  pruneExpired(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}
