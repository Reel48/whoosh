import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, sanitizeNext } from "@/lib/session";
import { signUp, signInWithDiscord } from "@/app/auth/actions";
import { AuthShell } from "@/app/login/page";
import { Bolt } from "@/components/Bolt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account — Whoosh" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = sanitizeNext(sp.next);

  if (await getSession()) redirect(next);

  return (
    <AuthShell title="Create your account" subtitle="Free to join. Premium is optional.">
      {sp.error && (
        <p className="rounded-xl border-2 border-ink bg-imperial-red px-3 py-2 text-sm font-medium text-white-smoke">
          {sp.error}
        </p>
      )}

      <form action={signInWithDiscord}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="auth-discord">
          <Bolt className="h-4 w-4" /> Continue with Discord
        </button>
      </form>

      <div className="auth-divider"><span>or</span></div>

      <form action={signUp} className="auth-form">
        <input type="hidden" name="next" value={next} />
        <label className="auth-label">
          Email
          <input name="email" type="email" required autoComplete="email" className="auth-input" />
        </label>
        <label className="auth-label">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="auth-input"
          />
        </label>
        <button type="submit" className="auth-submit">Create account</button>
      </form>

      <p className="auth-alt">
        Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </p>
    </AuthShell>
  );
}
