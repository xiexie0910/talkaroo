import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and Live streaming routes.
     * /api/live/stream (duplex) and /api/live/ws must not go through the
     * auth proxy — cloning/touching the request breaks streaming bodies.
     * Those routes call requireUser() themselves via cookies.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/live/stream|api/live/ws|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
