import Image from "next/image";
import Link from "next/link";
import { RecoverInvitesForm } from "@/components/join/RecoverInvitesForm";

export const metadata = {
  title: "Find your invite — Whoosh NFL pools",
  robots: { index: false, follow: false },
};

/**
 * Recovery for buyers who lost the `/join/complete` tab before grabbing every
 * invite — typically after tapping the first "Open in Sleeper" inside an
 * in-app browser (Discord, iMessage), which closes the page behind them. The
 * Stripe receipt points here. No session needed: the email they paid with is
 * the key.
 */
export default function JoinRecoverPage() {
  return (
    <>
      <header className="border-b-2 border-ink bg-white-smoke">
        <div className="mx-auto flex w-full max-w-3xl items-center px-6 py-4">
          <Image
            src="/whoosh-wordmark-ink.svg"
            alt="Whoosh"
            width={1440}
            height={368}
            className="h-6 w-auto"
            priority
          />
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b-2 border-ink bg-blue">
          <div className="mx-auto w-full max-w-3xl px-6 py-14 text-center sm:py-16">
            <span className="font-heading text-xs font-bold uppercase tracking-[0.22em] text-ink">
              Already paid?
            </span>
            <h1 className="mt-4 font-heading text-4xl font-black tracking-tight sm:text-5xl">
              Find your Sleeper invites.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-lg font-medium leading-relaxed text-ink/80">
              Lost the page after checkout? Enter the email you paid with and we&rsquo;ll pull up
              every pool you&rsquo;re in.
            </p>
          </div>
        </section>

        <section className="bg-white-smoke">
          <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-16">
            <RecoverInvitesForm />
            <p className="mt-8 text-center text-sm font-medium text-ink/60">
              Haven&rsquo;t joined yet?{" "}
              <Link href="/join" className="font-bold underline">
                Pick a pool
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-ink bg-white-smoke">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm font-medium text-ink/60">
          <span>© {new Date().getFullYear()} Whoosh</span>
          <span>Pools are hosted and played on Sleeper.</span>
        </div>
      </footer>
    </>
  );
}
