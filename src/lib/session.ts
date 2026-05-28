import crypto from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "whoosh_session";
const STATE_COOKIE = "whoosh_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const STATE_MAX_AGE = 10 * 60; // 10 minutes

export type Session = {
  id: string;
  username: string;
  /** Discord avatar hash, or null/undefined for users with no custom avatar. */
  avatar?: string | null;
};

function secret(): string {
  const s = process.env.DISCORD_SESSION_SECRET;
  if (!s) throw new Error("DISCORD_SESSION_SECRET is not set.");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function pack(value: object): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function unpack<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function setSession(s: Session) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, pack(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return unpack<Session>(jar.get(SESSION_COOKIE)?.value);
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Validate a `next` redirect target. Only internal paths starting with a single
 * leading slash are allowed, to prevent open-redirect abuse via OAuth.
 */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

/** Short-lived OAuth state cookie used to prevent CSRF on the callback. */
export async function setOAuthState(next: string): Promise<string> {
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = pack({ n: nonce, p: sanitizeNext(next) });
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE,
  });
  return state;
}

export async function consumeOAuthState(state: string): Promise<{ next: string } | null> {
  const jar = await cookies();
  const stored = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  if (!stored || stored !== state) return null;
  const payload = unpack<{ n: string; p: string }>(stored);
  return payload ? { next: sanitizeNext(payload.p) } : null;
}
