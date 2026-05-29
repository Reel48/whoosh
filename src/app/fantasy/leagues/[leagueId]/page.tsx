import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getNflState } from "@/lib/sleeper/client";
import { getLeagueOverview, getLeagueRosterDetail } from "@/lib/fantasy/leagues";
import { getWeekMatchups } from "@/lib/fantasy/matchups";
import { getLink } from "@/lib/fantasy/link";
import { currentScoringWeek, weekLabel } from "@/lib/fantasy/format";
import { StandingsTable } from "@/components/fantasy/StandingsTable";
import { MatchupCard } from "@/components/fantasy/MatchupCard";
import { RosterList } from "@/components/fantasy/RosterList";
import { TeamAvatar } from "@/components/fantasy/TeamAvatar";

export const dynamic = "force-dynamic";

type View = "standings" | "matchups" | "rosters";
const VIEWS: { key: View; label: string }[] = [
  { key: "standings", label: "Standings" },
  { key: "matchups", label: "Matchups" },
  { key: "rosters", label: "Rosters" },
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

  const [overview, link, state] = await Promise.all([
    getLeagueOverview(leagueId).catch(() => null),
    getLink(session.id).catch(() => null),
    getNflState().catch(() => null),
  ]);
  if (!overview) notFound();

  const mineRosterId =
    link != null
      ? overview.standings.find((s) => s.ownerId === link.sleeperUserId)?.rosterId ?? null
      : null;
  const week = currentScoringWeek(state);

  const [matchups, rosters] = await Promise.all([
    view === "matchups"
      ? getWeekMatchups(leagueId, week, link?.sleeperUserId).catch(() => [])
      : Promise.resolve([]),
    view === "rosters" ? getLeagueRosterDetail(leagueId).catch(() => []) : Promise.resolve([]),
  ]);

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
        <section className="ftb-mt-lg">
          <StandingsTable rows={overview.standings} mineRosterId={mineRosterId} />
        </section>
      )}

      {view === "matchups" && (
        <section className="ftb-mt-lg">
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
      )}

      {view === "rosters" && (
        <section className="ftb-mt-lg">
          {rosters.length === 0 ? (
            <div className="card ftb-empty">No roster data available.</div>
          ) : (
            <div className="ftb-cols">
              {rosters.map((r) => (
                <RosterList key={r.rosterId} roster={r} />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
