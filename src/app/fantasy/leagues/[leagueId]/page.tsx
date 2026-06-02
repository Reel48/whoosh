import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getNflState } from "@/lib/sleeper/client";
import { getLeagueOverview } from "@/lib/fantasy/leagues";
import { getWeekMatchups } from "@/lib/fantasy/matchups";
import { getLink } from "@/lib/fantasy/link";
import { hasLeagueAccess } from "@/lib/fantasy/entitlements";
import { currentScoringWeek, weekLabel } from "@/lib/fantasy/format";
import { StandingsTable } from "@/components/fantasy/StandingsTable";
import { MatchupCard } from "@/components/fantasy/MatchupCard";
import { TeamAvatar } from "@/components/fantasy/TeamAvatar";
import { LeaguePaywall } from "@/components/fantasy/LeaguePaywall";
import { InviteCard } from "@/components/fantasy/InviteCard";
import { Reveal } from "@/components/ui/Reveal";

export const dynamic = "force-dynamic";

type View = "standings" | "matchups";
const VIEWS: { key: View; label: string }[] = [
  { key: "standings", label: "Standings" },
  { key: "matchups", label: "Matchups" },
];

export default async function LeagueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const { leagueId } = await params;
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : "standings";

  const overview = await getLeagueOverview(leagueId).catch(() => null);
  if (!overview) notFound();

  // Per-league paywall: a priced league requires a paid entitlement seating the
  // member here. Free/legacy leagues (no fee) stay open to any signed-in member.
  const cfg = overview.config;
  const requiresPayment = (cfg.entryFeeCents ?? 0) > 0;
  const access = requiresPayment
    ? await hasLeagueAccess(session.id, leagueId, cfg.season).catch(() => false)
    : true;

  if (!access) {
    return (
      <main className="ftb-page ftb-page--wide">
        <Link href="/fantasy/leagues" className="ftb-link">
          ← All leagues
        </Link>
        <header className="ftb-welcome ftb-mt-sm">
          <TeamAvatar url={overview.avatarUrl} name={overview.displayName} size={44} />
          <div className="ftb-welcome__name">
            <p className="text-eyebrow">{overview.season} season</p>
            <h1 className="text-h1">{cfg.productName?.trim() || overview.displayName}</h1>
          </div>
        </header>
        <LeaguePaywall
          groupKey={cfg.groupKey}
          feeCents={cfg.entryFeeCents ?? 0}
          productName={cfg.productName?.trim() || overview.displayName}
        />
      </main>
    );
  }

  const [link, state] = await Promise.all([
    getLink(session.id).catch(() => null),
    getNflState().catch(() => null),
  ]);

  const mineRosterId =
    link != null
      ? overview.standings.find((s) => s.ownerId === link.sleeperUserId)?.rosterId ?? null
      : null;
  const week = currentScoringWeek(state);

  const matchups =
    view === "matchups"
      ? await getWeekMatchups(leagueId, week, link?.sleeperUserId).catch(() => [])
      : [];

  return (
    <main className="ftb-page ftb-page--wide">
      <Link href="/fantasy/leagues" className="ftb-link">
        ← All leagues
      </Link>
      <header className="ftb-welcome ftb-mt-sm">
        <TeamAvatar url={overview.avatarUrl} name={overview.displayName} size={44} />
        <div className="ftb-welcome__name">
          <p className="text-eyebrow">{overview.season} season</p>
          <h1 className="text-h1">{overview.displayName}</h1>
        </div>
      </header>

      {requiresPayment && cfg.joinUrl && (
        <Reveal direction="right">
          <InviteCard joinUrl={cfg.joinUrl} leagueName={overview.displayName} />
        </Reveal>
      )}

      <div className="ftb-tabs ftb-mt">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/fantasy/leagues/${leagueId}?view=${v.key}`}
            className={`ftb-tab ${v.key === view ? "is-active" : ""}`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {view === "standings" && (
        <Reveal direction="right" className="ftb-mt-lg">
        <section>
          <StandingsTable rows={overview.standings} mineRosterId={mineRosterId} />
        </section>
        </Reveal>
      )}

      {view === "matchups" && (
        <Reveal direction="right" className="ftb-mt-lg">
        <section>
          <h2 className="text-h2 ftb-section-title">{state ? weekLabel(state) : "This week"}</h2>
          {matchups.length === 0 ? (
            <div className="card ftb-empty">No matchups posted for this week yet.</div>
          ) : (
            <div className="ftb-stack">
              {matchups.map((m, i) => (
                <MatchupCard key={m.matchupId ?? `bye-${i}`} matchup={m} />
              ))}
            </div>
          )}
        </section>
        </Reveal>
      )}
    </main>
  );
}
