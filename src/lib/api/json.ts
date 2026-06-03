import { NextResponse } from "next/server";
import { getSessionFromBearer } from "@/lib/session";
import type { Session } from "@/lib/session";

/**
 * Shared helpers for the versioned JSON API under `src/app/api/v1/*`.
 *
 * Unlike the form-POST routes in `src/app/api/*` (which 303-redirect with a
 * `?error=` query string — a progressive-enhancement web idiom), the v1 routes
 * speak a stable JSON envelope so non-browser clients (the future iOS app) can
 * branch on a machine-readable result. Web and mobile call the same routes.
 *
 * Envelope:
 *   success → 2xx  { ok: true,  data: <payload> }
 *   failure → 4xx/5xx { ok: false, error: { code, message } }
 *
 * `code` is a stable enum (never localized, never reworded) the client switches
 * on; `message` is a human-readable string safe to surface in UI.
 */

/** Stable, client-switchable error codes. Add to this union, never repurpose. */
export type ApiErrorCode =
  | "unauthorized" // missing/invalid/expired bearer token
  | "forbidden" // authenticated but not allowed (e.g. not admin)
  | "validation" // malformed or missing request fields
  | "not_found" // target resource does not exist
  | "conflict" // idempotency/state conflict (e.g. already settled)
  | "insufficient_funds" // not enough Whoosh Bucks for the operation
  | "not_entitled" // lacks the entitlement (e.g. unpaid league)
  | "rate_limited" // too many requests
  | "internal"; // unexpected server error

/** Default HTTP status per error code, used when the caller omits one. */
const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  validation: 400,
  not_found: 404,
  conflict: 409,
  insufficient_funds: 402,
  not_entitled: 402,
  rate_limited: 429,
  internal: 500,
};

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: ApiErrorCode; message: string } };

/** 2xx JSON success envelope. */
export function jsonOk<T>(data: T, status = 200): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true as const, data }, { status });
}

/**
 * Error JSON envelope. The HTTP status defaults to the code's canonical status
 * ({@link STATUS_BY_CODE}); pass `status` only to override.
 */
export function jsonError(
  code: ApiErrorCode,
  message: string,
  status?: number,
): NextResponse<ApiErr> {
  return NextResponse.json(
    { ok: false as const, error: { code, message } },
    { status: status ?? STATUS_BY_CODE[code] },
  );
}

/**
 * Require a signed-in session from the `Authorization: Bearer <jwt>` header.
 * Returns the {@link Session}, or a 401 JSON error the caller returns directly:
 *
 * ```ts
 * const session = await requireBearerSession(req);
 * if (session instanceof NextResponse) return session;
 * ```
 *
 * This is the API-side counterpart to `requireSession` in `./redirect.ts`,
 * which redirects to `/login` for the cookie-bound web flow.
 */
export async function requireBearerSession(
  req: Request,
): Promise<Session | NextResponse<ApiErr>> {
  const token = bearerToken(req);
  if (!token) {
    return jsonError("unauthorized", "Missing or malformed Authorization header.");
  }
  const session = await getSessionFromBearer(token);
  if (!session) {
    return jsonError("unauthorized", "Invalid or expired token.");
  }
  return session;
}

/** Extract the raw JWT from an `Authorization: Bearer <jwt>` header, or null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Parse a JSON request body, returning null on malformed/empty input. Callers
 * turn null into `jsonError("validation", ...)`. Centralizes the per-route
 * try/catch the form routes used to do around `req.formData()`.
 */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Map a domain result onto the JSON envelope.
 *
 * Many lib functions (`placeWager`, `transfer`, `placeOrder`, …) already return
 * a discriminated `{ ok: true; ...fields } | { ok: false; error: string }`.
 * This turns the success branch into `jsonOk(toData(result))` and the failure
 * branch into a `jsonError` whose code is inferred from the human message via
 * {@link codeForError}, so the phrase→code mapping lives in one place instead
 * of being re-implemented per route.
 */
export function respondResult<T, D>(
  result: ({ ok: true } & T) | { ok: false; error: string },
  toData: (r: { ok: true } & T) => D,
  extraCodes?: Array<[string, ApiErrorCode]>,
): NextResponse<ApiOk<D>> | NextResponse<ApiErr> {
  if (result.ok) return jsonOk(toData(result));
  return jsonError(codeForError(result.error, extraCodes), result.error);
}

/** Phrase fragments → error code, checked (case-insensitive) in order. */
const DEFAULT_ERROR_PHRASES: Array<[string, ApiErrorCode]> = [
  ["insufficient", "insufficient_funds"],
  ["not enough", "insufficient_funds"],
  ["not open", "conflict"],
  ["closed", "conflict"],
  ["already", "conflict"],
  ["not entitled", "not_entitled"],
  ["no access", "not_entitled"],
  ["not found", "not_found"],
];

/**
 * Infer a stable {@link ApiErrorCode} from a human error message. Caller-supplied
 * `extra` pairs are checked before the defaults; falls back to `validation`.
 */
export function codeForError(
  message: string,
  extra: Array<[string, ApiErrorCode]> = [],
): ApiErrorCode {
  const lower = message.toLowerCase();
  for (const [phrase, code] of [...extra, ...DEFAULT_ERROR_PHRASES]) {
    if (lower.includes(phrase)) return code;
  }
  return "validation";
}
