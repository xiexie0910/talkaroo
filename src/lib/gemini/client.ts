import { GoogleGenAI } from "@google/genai";
import {
  getGoogleCloudLocation,
  requireGoogleCloudProject,
} from "@/lib/env/server";

/**
 * Server-side Gemini client via Vertex AI + Application Default Credentials.
 * Requires: gcloud auth application-default login
 * Env: GOOGLE_CLOUD_PROJECT, optional GOOGLE_CLOUD_LOCATION
 */
export function createGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: requireGoogleCloudProject(),
    location: getGoogleCloudLocation(),
  });
}
