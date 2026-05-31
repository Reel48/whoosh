/**
 * Shown to a paid member on their league page: the Sleeper invite link to join
 * the actual league on Sleeper, where the games are played. Only rendered once
 * an entitlement exists, so the link never leaks to non-payers.
 */
export function InviteCard({
  joinUrl,
  leagueName,
}: {
  joinUrl: string;
  leagueName: string;
}) {
  return (
    <section className="card ftb-mt">
      <div className="ftb-card-head">
        <div className="min-w-0">
          <p className="text-eyebrow">You&apos;re in</p>
          <p className="text-h3 ftb-mt-1">Join {leagueName} on Sleeper</p>
        </div>
        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary shrink-0"
        >
          Open Sleeper invite ↗
        </a>
      </div>
      <p className="text-body-sm ftb-mt-sm">
        Tap the invite to claim your spot on Sleeper. Keep this link handy — it&apos;s
        how you draft and set your lineup.
      </p>
    </section>
  );
}
