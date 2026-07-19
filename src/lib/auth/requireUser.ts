import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email?: string;
};

export type RequireUserOk = {
  user: AuthUser;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

export type RequireUserErr = {
  error: NextResponse;
};

/** Verify JWT via getClaims and return the authenticated user + server client. */
export async function requireUser(): Promise<RequireUserOk | RequireUserErr> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;

    if (error || typeof sub !== "string" || !sub) {
      return {
        error: NextResponse.json(
          { error: "Sign in required" },
          { status: 401 },
        ),
      };
    }

    const email =
      typeof data.claims.email === "string" ? data.claims.email : undefined;

    return { user: { id: sub, email }, supabase };
  } catch (err) {
    console.error("[auth]", err);
    return {
      error: NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Auth is not configured",
        },
        { status: 503 },
      ),
    };
  }
}

export function isRequireUserError(
  result: RequireUserOk | RequireUserErr,
): result is RequireUserErr {
  return "error" in result;
}
