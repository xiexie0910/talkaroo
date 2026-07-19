import { GoogleGenAI } from "@google/genai";
import {
  getGoogleCloudLocation,
  requireGoogleCloudProject,
} from "@/lib/env/server";

type ServiceAccountAuth = {
  credentials: {
    client_email: string;
    private_key: string;
    [key: string]: unknown;
  };
};

/**
 * Server-side Gemini client via Vertex AI.
 * Local: Application Default Credentials (`gcloud auth application-default login`).
 * Vercel: set GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_JSON).
 */
export function createGenAIClient(): GoogleGenAI {
  const googleAuthOptions = resolveGoogleAuthOptions();
  return new GoogleGenAI({
    vertexai: true,
    project: requireGoogleCloudProject(),
    location: getGoogleCloudLocation(),
    ...(googleAuthOptions ? { googleAuthOptions } : {}),
  });
}

function resolveGoogleAuthOptions(): ServiceAccountAuth | undefined {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawJson) {
    try {
      const credentials = JSON.parse(rawJson) as ServiceAccountAuth["credentials"];
      if (!credentials.client_email || !credentials.private_key) {
        throw new Error("missing client_email or private_key");
      }
      return { credentials };
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid service-account JSON");
    }
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    return {
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    };
  }

  return undefined;
}
