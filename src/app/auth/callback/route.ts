import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/lib/safeRedirect";
import { createClient } from "@/lib/supabase/server";

/** OAuth / magic-link PKCE callback — exchanges `code` for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const safeNext = safeInternalPath(searchParams.get("next"), "/session");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("auth_callback_failed")}`,
  );
}
