import { NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/session";

/**
 * Shared helpers for the form-POST API routes under `src/app/api/*`.
 *
 * These routes are progressive-enhancement form targets: they do work and then
 * 303-redirect back to the page that posted, carrying a `?error=` message or a
 * success marker in the query string. Every route used to re-implement the same
 * `getSession → redirect`, `back(req, msg)`, and success-redirect dance; these
 * helpers centralize it so the routes carry only their own logic.
 */

/** 303 redirect to an internal `path` (resolved against the request URL). */
export function seeOther(req: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.url), 303);
}

/** Redirect back to `dest` with a user-facing `?error=` message. */
export function redirectError(req: Request, dest: string, message: string): NextResponse {
  return seeOther(req, `${dest}?error=${encodeURIComponent(message)}`);
}

/**
 * Redirect to `dest` with an optional success marker query (e.g. `"transfer=ok"`
 * or `"order=ok"`). Pass no query to redirect to the bare path.
 */
export function redirectOk(req: Request, dest: string, query = ""): NextResponse {
  return seeOther(req, query ? `${dest}?${query}` : dest);
}

/**
 * Require a signed-in session. Returns the {@link Session}, or a 303 redirect to
 * the Discord OAuth start (preserving `next`) that the caller should return
 * directly:
 *
 * ```ts
 * const session = await requireSession(req, "/capital/wallet");
 * if (session instanceof NextResponse) return session;
 * ```
 */
export async function requireSession(
  req: Request,
  next: string,
): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) {
    return seeOther(req, `/api/auth/discord?next=${encodeURIComponent(next)}`);
  }
  return session;
}
