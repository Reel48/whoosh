import Image from "next/image";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { Bolt } from "@/components/Bolt";
import { InviteLink } from "@/components/join/InviteLink";
import {
  getPoolInvites,
  readPoolSession,
  recordPoolPurchase,
  type PoolInvite,
} from "@/lib/fantasy/poolEntry";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "You're in — Whoosh NFL pools",
  // A one-off URL keyed to a Stripe session; nothing for a crawler here.
  robots: { index: false, follow: false },
};

/**
 * Stripe Checkout success landing for an anonymous pool entry.
 *
 * The invite links are the product, so they're revealed only after retrieving
 * the Checkout Session from Stripe and confirming it's paid — a guessed
 * `session_id` gets nothing. The purchase is recorded here as well as in the
 * webhook (idempotent on the session id), so the record exists even if the
 * webhook is delayed, and the buyer sees their invite even if it never lands.
 */
export default async function JoinCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/join");

  let invites: PoolInvite[] = [];
  let paid = false;
  let email: string | null = null;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey) {
    try {
      const stripe = new Stripe(secretKey);
      const cs = await stripe.checkout.sessions.retrieve(sessionId);
      const purchase = cs.payment_status === "paid" ? readPoolSession(cs) : null;
      if (purchase) {
        paid = true;
        email = purchase.email;
        const paymentIntentId =
          typeof cs.payment_intent === "string" ? cs.payment_intent : cs.payment_intent?.id ?? null;
        await recordPoolPurchase({
          purchase,
          amountCents: cs.amount_total ?? 0,
          stripeSessionId: cs.id,
          stripePaymentIntentId: paymentIntentId,
        }).catch((e) => console.error("recordPoolPurchase (success page) failed:", e));
        invites = await getPoolInvites(purchase.groupKeys, purchase.season).catch(() => []);
      }
    } catch (e) {
      console.error("Pool checkout finalize failed:", e);
    }
  }

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
        <section className={`border-b-2 border-ink ${paid ? "bg-lime" : "bg-white-smoke"}`}>
          <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center sm:py-20">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-ink bg-ink">
              <Bolt className={`h-10 w-10 ${paid ? "text-lime" : "text-white-smoke"}`} />
            </div>
            <h1 className="mt-8 font-heading text-4xl font-black tracking-tight sm:text-5xl">
              {paid ? "You’re in." : "Hang tight."}
            </h1>
            <p className="mx-auto mt-5 max-w-md text-lg font-medium leading-relaxed text-ink/80">
              {paid && invites.length > 0
                ? "Tap your invite below to claim your spot on Sleeper. That’s where you make your picks all season."
                : "We haven’t been able to confirm this payment yet. Refresh in a moment — nothing else is needed from you."}
            </p>
            {email && (
              <p className="mt-4 text-sm font-medium text-ink/60">
                Receipt sent to {email}
              </p>
            )}
          </div>
        </section>

        <section className="bg-white-smoke">
          <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-16">
            {invites.length > 0 ? (
              <>
                <div className="grid gap-6">
                  {invites.map((i) => (
                    <InviteLink key={i.joinUrl} name={i.name} joinUrl={i.joinUrl} />
                  ))}
                </div>
                <div className="mt-8 rounded-3xl border-2 border-ink bg-white p-6">
                  <h2 className="font-heading text-xl font-bold">Before you close this tab</h2>
                  <ul className="mt-3 space-y-2 text-base font-medium leading-relaxed text-ink/75">
                    <li>
                      · Bookmark this page — it stays live, so your invite link is always here.
                    </li>
                    <li>· You&rsquo;ll need a free Sleeper account to accept the invite.</li>
                    <li>· Get your first picks in before kickoff of the opening week.</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="rounded-3xl border-2 border-ink bg-white p-8 text-center">
                <p className="font-heading text-2xl font-black tracking-tight">
                  {paid ? "Your invite is on its way" : "Nothing to show yet"}
                </p>
                <p className="mt-3 text-base font-medium text-ink/70">
                  {paid
                    ? "Your payment went through, but the invite link isn’t ready. Refresh in a moment — your spot is already paid for."
                    : "If you were charged, refresh this page — it’ll pick up as soon as Stripe settles. If you haven’t paid yet, head back and pick a pool."}
                </p>
              </div>
            )}
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
