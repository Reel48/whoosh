"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSession, sanitizeNext } from "@/lib/session";
import { persistHandle, setHasPassword } from "@/lib/auth";

const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;

/**
 * Auth server actions backing the /login, /signup, and /account forms. All run
 * on the server against the cookie-bound Supabase client, so the auth cookie is
 * set/cleared on the response automatically.
 */

/** Same-origin base URL for auth redirects (uses the request host in dev). */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? "/home"));

  const sb = await createServerSupabase();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? "/home"));

  if (password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent("Password must be at least 8 characters.")}&next=${encodeURIComponent(next)}`);
  }

  const sb = await createServerSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }
  // If confirmations are on, there's no session yet — tell them to check email.
  if (data.user && !data.session) {
    redirect(`/login?check=1&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function signInWithDiscord(formData: FormData) {
  const next = sanitizeNext(String(formData.get("next") ?? "/home"));
  const sb = await createServerSupabase();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data?.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Discord sign-in failed.")}`);
  }
  redirect(data.url);
}

export async function signOut() {
  const sb = await createServerSupabase();
  await sb.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const sb = await createServerSupabase();
  await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent("/account/password")}`,
  });
  // Always report success — don't reveal whether the email exists.
  redirect("/login?reset=sent");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  // `back` lets both the recovery page and the account card reuse this action.
  const back = sanitizeNext(String(formData.get("back") ?? "/account/password"));
  if (password.length < 8) {
    redirect(`${back}?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }
  const sb = await createServerSupabase();
  const { data, error } = await sb.auth.updateUser({ password });
  if (error) {
    redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  }
  // Record that email + password login is now available for this account.
  if (data.user) await setHasPassword(data.user.id, true).catch(() => {});
  redirect("/account?password=updated");
}

/** Change the unique @handle (shown on leaderboards, used for WB transfers). */
export async function updateHandle(formData: FormData) {
  const handle = String(formData.get("handle") ?? "").trim();
  const session = await getSession();
  if (!session) redirect("/login?next=/account");
  if (!HANDLE_RE.test(handle)) {
    redirect(`/account?error=${encodeURIComponent("Handle must be 3–20 letters, numbers, or underscores.")}`);
  }
  const res = await persistHandle(session.id, handle);
  if (!res.ok) {
    redirect(`/account?error=${encodeURIComponent(res.message)}`);
  }
  redirect("/account?handle=updated");
}

/** Add or change the login email. Supabase emails a confirmation to the new
 *  address; /auth/confirm verifies it and makes it the login email. */
export async function updateEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const session = await getSession();
  if (!session) redirect("/login?next=/account");
  const sb = await createServerSupabase();
  const { error } = await sb.auth.updateUser(
    { email },
    { emailRedirectTo: `${await origin()}/auth/confirm?next=/account` },
  );
  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/account?email=pending");
}
