/** Fail-fast server env checks (call at the edge of Vertex / Supabase usage). */

export function requireGoogleCloudProject(): string {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (!project) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT is required for ADC / Vertex AI. Set it in .env.local.",
    );
  }
  return project;
}

export function getGoogleCloudLocation(): string {
  return process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1";
}
