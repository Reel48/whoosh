import { joinLeagueAction } from "@/app/fantasy/actions";
import { TeamAvatar } from "./TeamAvatar";

export type JoinOption = {
  groupKey: string;
  productName: string;
  feeCents: number;
  /** Short descriptor, e.g. "PPR · 10-team" or "Survivor". */
  blurb: string;
  badge: string;
  logoUrl: string | null;
};

function fmtUsd(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/**
 * Locked card shown on the Leagues grid for a group the member hasn't bought
 * into yet. The button posts to {@link joinLeagueAction}, which sends them to
 * Stripe Checkout. On success they're seated in one of the group's leagues and
 * shown its Sleeper invite.
 */
export function JoinCard({ option }: { option: JoinOption }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <TeamAvatar url={option.logoUrl} name={option.productName} size={40} />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <h3 className="text-h3 truncate">{option.productName}</h3>
          <span className="badge badge-accent shrink-0">{option.badge}</span>
        </div>
      </div>

      <p className="text-body-sm ftb-mt-sm">{option.blurb}</p>

      <div className="ftb-mt-sm flex items-center justify-between gap-2">
        <span className="text-h3">{fmtUsd(option.feeCents)}</span>
        <span className="text-caption">season buy-in</span>
      </div>

      <form action={joinLeagueAction} className="ftb-mt-sm">
        <input type="hidden" name="group_key" value={option.groupKey} />
        <button type="submit" className="btn btn-primary w-full">
          Join for {fmtUsd(option.feeCents)} →
        </button>
      </form>
    </div>
  );
}
