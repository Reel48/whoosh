import { joinLeagueAction } from "@/app/fantasy/actions";

function fmtUsd(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/**
 * Full-width paywall shown on a league detail page when the member hasn't paid
 * the buy-in. Posts to {@link joinLeagueAction} → Stripe Checkout; after payment
 * they're seated and the standings + Sleeper invite unlock.
 */
export function LeaguePaywall({
  groupKey,
  feeCents,
  productName,
}: {
  groupKey: string;
  feeCents: number;
  productName: string;
}) {
  return (
    <section className="card ftb-mt-lg">
      <p className="text-eyebrow">Members only</p>
      <h2 className="text-h2 ftb-mt-1">Join {productName}</h2>
      <p className="text-body-sm ftb-mt-sm">
        Pay the one-time season buy-in to unlock standings, matchups, and your
        Sleeper invite link. You&apos;ll be placed into a league automatically.
      </p>
      <div className="ftb-mt flex items-center justify-between gap-3">
        <span className="text-h2">{fmtUsd(feeCents)}</span>
        <span className="text-caption">one-time · season entry</span>
      </div>
      <form action={joinLeagueAction} className="ftb-mt">
        <input type="hidden" name="group_key" value={groupKey} />
        <button type="submit" className="btn btn-primary w-full">
          Join for {fmtUsd(feeCents)} →
        </button>
      </form>
      <p className="text-caption ftb-mt-sm">Secure checkout powered by Stripe.</p>
    </section>
  );
}
