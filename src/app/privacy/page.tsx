import { Nav } from "@/components/Nav";

export const metadata = { title: "Privacy — Whoosh" };

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <span className="text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink">
          Legal
        </span>
        <h1 className="mt-4 font-heading text-4xl font-black tracking-tight sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-ink/60">Last updated: May 28, 2026</p>

        <div className="mt-8 space-y-6">
          <Section title="What we collect">
            <ul className="ml-5 list-disc space-y-1">
              <li>
                <strong className="font-heading">Discord identity</strong> — your
                Discord user ID, username, avatar hash, and guild membership
                status. Collected via Discord OAuth when you sign in.
              </li>
              <li>
                <strong className="font-heading">Stripe customer data</strong> —
                we receive your Stripe customer ID and subscription status; we
                never see or store full card numbers.
              </li>
              <li>
                <strong className="font-heading">Whoosh Bucks activity</strong> —
                your in-community ledger: purchases, transfers, interest,
                trades, wagers, dividends.
              </li>
              <li>
                <strong className="font-heading">Standard request logs</strong> —
                IP, user agent, timestamp on our edge for debugging and abuse
                prevention.
              </li>
            </ul>
          </Section>

          <Section title="Why we collect it">
            To grant your Discord Premium role on payment, run the Whoosh
            Bucks simulation, show you your own data, and keep the service
            online. That&rsquo;s it.
          </Section>

          <Section title="Who we share it with">
            <ul className="ml-5 list-disc space-y-1">
              <li>
                <strong className="font-heading">Stripe</strong> — payments,
                subscription management.
              </li>
              <li>
                <strong className="font-heading">Discord</strong> — authentication,
                role grants.
              </li>
              <li>
                <strong className="font-heading">Supabase</strong> — our database
                and edge functions.
              </li>
              <li>
                <strong className="font-heading">Vercel</strong> — hosting.
              </li>
              <li>
                Market-data providers (Finnhub, Yahoo) — we pass them only the
                symbol you look up, never your identity.
              </li>
            </ul>
            We do not sell your data and we don&rsquo;t run ad trackers.
          </Section>

          <Section title="Cookies">
            We set a session cookie when you sign in with Discord, and Stripe
            sets its own cookies on checkout / portal pages. No analytics
            cookies.
          </Section>

          <Section title="Your rights">
            Want your data exported or deleted? Message an admin in the Whoosh
            Discord. Deletion removes your wallet, ledger, positions, and
            orders; subscription history may be retained for tax/legal
            reasons.
          </Section>

          <Section title="Contact">
            DM an admin in the Whoosh Discord.
          </Section>
        </div>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-xl font-bold text-ink">{title}</h2>
      <div className="mt-2 text-sm font-medium leading-relaxed text-ink/75">
        {children}
      </div>
    </section>
  );
}
