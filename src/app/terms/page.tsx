import { Nav } from "@/components/Nav";

export const metadata = { title: "Terms — Whoosh" };

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <span className="text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink">
          Legal
        </span>
        <h1 className="mt-4 font-heading text-4xl font-black tracking-tight sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-ink/60">Last updated: May 28, 2026</p>

        <div className="prose mt-8 max-w-none space-y-6 text-ink/80">
          <Section title="1. What Whoosh is">
            Whoosh is a paid Discord community covering sports, entertainment,
            business, and adjacent topics. Subscribing to Whoosh Premium grants
            access to members-only Discord channels and to in-community
            features hosted on this site, including Whoosh Bucks.
          </Section>

          <Section title="2. Subscriptions and billing">
            Payments are processed by Stripe. By subscribing you authorize
            recurring charges to your selected billing cycle until you cancel.
            You can cancel any time via the Stripe customer portal linked from
            your account page; access continues until the end of the paid
            period. Refunds are at our sole discretion.
          </Section>

          <Section title="3. Whoosh Bucks (WB)">
            WB is a closed-loop, simulated currency used inside Whoosh. WB has
            no monetary value, is not redeemable for cash or any thing of
            value, is not transferable outside Whoosh, and is not a security,
            commodity, deposit, or financial instrument. Buying WB through
            Stripe is a payment for the in-community experience, not an
            investment. Simulated &ldquo;investing&rdquo; and &ldquo;wagering&rdquo;
            features use WB only — no real money is at stake in any in-app
            trade, position, or wager.
          </Section>

          <Section title="4. Not financial advice">
            Prices, returns, dividends, and any other figures shown on Whoosh
            are for entertainment and education only and do not constitute
            financial, investment, legal, or tax advice. Do not rely on Whoosh
            for any real-world investment decision.
          </Section>

          <Section title="5. Acceptable use">
            Don&rsquo;t abuse the platform — no exploits of the WB economy, no
            harassment in Discord, no attempts to derive real-world value from
            WB through external trades. We may suspend or terminate accounts
            that violate these rules or the Discord Community Guidelines.
          </Section>

          <Section title="6. Account and data">
            We use your Discord identity to grant roles and run the WB
            simulation. See our{" "}
            <a href="/privacy" className="font-bold underline">
              Privacy Policy
            </a>{" "}
            for what we collect and why.
          </Section>

          <Section title="7. Disclaimers">
            Whoosh is provided &ldquo;as is&rdquo; without warranty of any kind.
            We don&rsquo;t guarantee uptime, data accuracy, or that any feature
            will be available in the future. Market quotes are delayed and may
            be incorrect.
          </Section>

          <Section title="8. Limitation of liability">
            To the maximum extent allowed by law, our liability is limited to
            the amount you have paid Whoosh in the prior 12 months. We are not
            liable for indirect, incidental, or consequential damages.
          </Section>

          <Section title="9. Changes">
            We may update these terms; continued use after an update is
            acceptance of the new terms.
          </Section>

          <Section title="10. Contact">
            Questions about these terms? DM an admin in the Whoosh Discord.
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
