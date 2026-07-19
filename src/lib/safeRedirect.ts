/**
 * Allow only same-origin relative paths (blocks open redirects via `//evil.com`).
 */
export function safeInternalPath(
  next: string | null | undefined,
  fallback = "/session",
): string {
  if (!next) return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\") || trimmed.includes("://")) return fallback;
  // Keep query/hash on internal paths; reject control chars.
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return fallback;
  return trimmed;
}
