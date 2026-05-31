import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { updatePassword } from "@/app/auth/actions";
import { AuthShell } from "@/app/login/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set password — Whoosh" };

/**
 * Set/change password. Reached from a recovery email (which establishes a
 * session via /auth/confirm) or from a signed-in account. Requires a session.
 */
export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  if (!(await getSession())) redirect("/login?next=/account/password");

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password for your account.">
      {sp.error && (
        <p className="rounded-xl border-2 border-ink bg-imperial-red px-3 py-2 text-sm font-medium text-white-smoke">
          {sp.error}
        </p>
      )}
      <form action={updatePassword} className="auth-form">
        <label className="auth-label">
          New password
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="auth-input" />
        </label>
        <button type="submit" className="auth-submit">Update password</button>
      </form>
    </AuthShell>
  );
}
