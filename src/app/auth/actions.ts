"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { sanitizeNext } from "@/lib/session";

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
  if (password.length < 8) {
    redirect(`/account/password?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }
  const sb = await createServerSupabase();
  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    redirect(`/account/password?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/account?password=updated");
}
