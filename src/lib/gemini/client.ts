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
  // Prefer dedicated JSON env. Also accept full SA JSON mistakenly pasted into
  // GOOGLE_PRIVATE_KEY (common Vercel mistake → OpenSSL DECODER errors).
  const rawJson =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ||
    (process.env.GOOGLE_PRIVATE_KEY?.trim().startsWith("{")
      ? process.env.GOOGLE_PRIVATE_KEY.trim()
      : undefined);

  if (rawJson) {
    return credentialsFromServiceAccountJson(rawJson);
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKeyEnv = process.env.GOOGLE_PRIVATE_KEY?.trim();
  const privateKeyB64 = process.env.GOOGLE_PRIVATE_KEY_BASE64?.trim();

  if (clientEmail && privateKeyEnv) {
    return {
      credentials: {
        client_email: clientEmail,
        private_key: normalizePrivateKey(privateKeyEnv),
      },
    };
  }

  if (clientEmail && privateKeyB64) {
    return {
      credentials: {
        client_email: clientEmail,
        private_key: normalizePrivateKey(
          Buffer.from(privateKeyB64, "base64").toString("utf8"),
        ),
      },
    };
  }

  return undefined;
}

function credentialsFromServiceAccountJson(raw: string): ServiceAccountAuth {
  let credentials: ServiceAccountAuth["credentials"];
  try {
    credentials = JSON.parse(raw) as ServiceAccountAuth["credentials"];
  } catch {
    throw new Error(
      "Service account env is not valid JSON — use GOOGLE_SERVICE_ACCOUNT_JSON with the full key file",
    );
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }
  return {
    credentials: {
      ...credentials,
      private_key: normalizePrivateKey(String(credentials.private_key)),
    },
  };
}

/** Vercel often mangles PEM newlines; normalize before google-auth signing. */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  // JSON / Vercel UI often store literal \n (sometimes double-escaped).
  key = key.replace(/\r\n/g, "\n");
  for (let i = 0; i < 3 && key.includes("\\n"); i++) {
    key = key.replace(/\\n/g, "\n");
  }
  if (!key.includes("BEGIN") && /^[A-Za-z0-9+/=\s]+$/.test(key)) {
    // Raw base64 body without PEM headers — wrap as PKCS#8.
    const body = key.replace(/\s+/g, "");
    key = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join("\n") ?? body}\n-----END PRIVATE KEY-----`;
  }
  if (!key.includes("BEGIN PRIVATE KEY") && !key.includes("BEGIN RSA PRIVATE KEY")) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY is not a valid PEM key (check newlines / paste format)",
    );
  }
  return key;
}
