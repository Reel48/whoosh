import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession, sanitizeNext } from "@/lib/session";
import { signIn, signInWithDiscord, requestPasswordReset } from "@/app/auth/actions";
import { Bolt } from "@/components/Bolt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Whoosh" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; check?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  const next = sanitizeNext(sp.next);

  // Already signed in → straight to the app.
  if (await getSession()) redirect(next);

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Whoosh account.">
      {sp.check && (
        <Notice tone="info">Check your email to confirm your account, then sign in.</Notice>
      )}
      {sp.reset === "sent" && (
        <Notice tone="info">If that email has an account, a reset link is on its way.</Notice>
      )}
      {sp.error && <Notice tone="error">{sp.error}</Notice>}

      <form action={signInWithDiscord}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="auth-discord">
          <Bolt className="h-4 w-4" /> Continue with Discord
        </button>
      </form>

      <div className="auth-divider"><span>or</span></div>

      <form action={signIn} className="auth-form">
        <input type="hidden" name="next" value={next} />
        <label className="auth-label">
          Email
          <input name="email" type="email" required autoComplete="email" className="auth-input" />
        </label>
        <label className="auth-label">
          Password
          <input name="password" type="password" required autoComplete="current-password" className="auth-input" />
        </label>
        <button type="submit" className="auth-submit">Sign in</button>
      </form>

      <details className="auth-forgot">
        <summary>Forgot your password?</summary>
        <form action={requestPasswordReset} className="auth-form" style={{ marginTop: "0.75rem" }}>
          <label className="auth-label">
            Email
            <input name="email" type="email" required className="auth-input" />
          </label>
          <button type="submit" className="auth-submit-secondary">Email me a reset link</button>
        </form>
      </details>

      <p className="auth-alt">
        New here? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white-smoke px-6 py-16 text-ink">
      <Link href="/" className="mb-8" aria-label="Whoosh — home">
        <Image src="/whoosh-wordmark-ink.svg" alt="Whoosh" width={1440} height={368} className="h-7 w-auto" priority />
      </Link>
      <div className="w-full max-w-sm rounded-3xl border-2 border-ink bg-white p-8">
        <h1 className="font-heading text-2xl font-black tracking-tight">{title}</h1>
        <p className="mt-1 text-sm font-medium text-ink/70">{subtitle}</p>
        <div className="mt-6 flex flex-col gap-4">{children}</div>
      </div>
    </main>
  );
}

function Notice({ tone, children }: { tone: "info" | "error"; children: React.ReactNode }) {
  const cls = tone === "error" ? "bg-imperial-red text-white-smoke" : "bg-blue text-ink";
  return (
    <p className={`rounded-xl border-2 border-ink px-3 py-2 text-sm font-medium ${cls}`}>{children}</p>
  );
}
