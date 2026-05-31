import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 Proxy (formerly Middleware). Refreshes the Supabase Auth session
 * cookie on every matched request. Route protection itself lives in the section
 * layouts, not here — see `src/lib/supabase/proxy.ts`.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and image files. Auth routes and
     * the marketing pages are intentionally included so the session stays
     * fresh everywhere it might be read.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
