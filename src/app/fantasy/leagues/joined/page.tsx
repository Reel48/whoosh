import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { getSession } from "@/lib/session";
import { assignEntitlement } from "@/lib/fantasy/entitlements";
import { creditCheckoutSession } from "@/lib/wb/stripeCredits";
import { getLeagueConfig } from "@/lib/fantasy/leagues";
import { InviteCard } from "@/components/fantasy/InviteCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "You're in — Whoosh Fantasy" };

/**
 * Stripe Checkout success landing for a league buy-in. Finalizes the
 * entitlement here (idempotent with the webhook) by retrieving the paid
 * session, so the buyer is seated and shown their Sleeper invite even if the
 * webhook is delayed or never arrives.
 */
export default async function JoinedPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect("/fantasy/leagues");

  const secretKey = process.env.STRIPE_SECRET_KEY;
  let assignedLeagueId: string | null = null;
  let status: "active" | "unassigned" | "pending" = "pending";

  if (secretKey) {
    try {
      const stripe = new Stripe(secretKey);
      const cs = await stripe.checkout.sessions.retrieve(sessionId);
      const meta = cs.metadata ?? {};
      // Only finalize a genuinely paid session that belongs to this member.
      if (
        cs.payment_status === "paid" &&
        meta.kind === "league_entry" &&
        meta.discord_user_id === session.id &&
        meta.group_key &&
        meta.season
      ) {
        const paymentIntentId =
          typeof cs.payment_intent === "string"
            ? cs.payment_intent
            : cs.payment_intent?.id ?? null;
        const ent = await assignEntitlement({
          discordUserId: session.id,
          discordUsername: session.username,
          groupKey: meta.group_key,
          season: meta.season,
          amountCents: cs.amount_total ?? 0,
          stripeSessionId: cs.id,
          stripePaymentIntentId: paymentIntentId,
        });
        if (ent?.status === "active" && ent.assignedLeagueId) {
          assignedLeagueId = ent.assignedLeagueId;
          status = "active";
        } else if (ent) {
          status = "unassigned";
        }
        // Credit the fantasy WB match now (idempotent — webhook/reconciler also
        // do this) so the buyer's balance reflects it immediately.
        await creditCheckoutSession(stripe, cs).catch(() => {});
      }
    } catch (e) {
      console.error("Joined finalize failed:", e);
    }
  }

  const league = assignedLeagueId ? await getLeagueConfig(assignedLeagueId).catch(() => null) : null;
  const leagueName = league?.name?.trim() || league?.productName?.trim() || "your league";

  return (
    <main className="ftb-page ftb-page--wide">
      <Link href="/fantasy/leagues" className="ftb-link">
        ← All leagues
      </Link>

      <header className="ftb-welcome ftb-mt-sm">
        <div className="ftb-welcome__name">
          <p className="text-eyebrow">Payment complete</p>
          <h1 className="text-h1">
            {status === "active" ? "You're in! 🎉" : "Thanks — payment received"}
          </h1>
        </div>
      </header>

      {status === "active" && assignedLeagueId && league?.joinUrl ? (
        <>
          <p className="text-body-sm ftb-mt">
            You&apos;ve been placed in <strong>{leagueName}</strong>. Grab your Sleeper
            invite below, then head to your league.
          </p>
          <InviteCard joinUrl={league.joinUrl} leagueName={leagueName} />
          <div className="ftb-mt">
            <Link href={`/fantasy/leagues/${assignedLeagueId}`} className="btn btn-primary">
              Go to {leagueName} →
            </Link>
          </div>
        </>
      ) : (
        <div className="card ftb-mt-lg">
          <p className="text-h3">We&apos;re finalizing your spot</p>
          <p className="text-body-sm ftb-mt-sm">
            Your payment went through. If your league doesn&apos;t appear in a moment,
            refresh this page or check{" "}
            <Link href="/fantasy/leagues" className="ftb-link">
              Leagues
            </Link>
            . You&apos;ll also get a notification once your invite is ready.
          </p>
        </div>
      )}
    </main>
  );
}
