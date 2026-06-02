import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getNflState, getLeague } from "@/lib/sleeper/client";
import { listActiveLeagues } from "@/lib/fantasy/leagues";
import { getWeekMatchups, type Matchup } from "@/lib/fantasy/matchups";
import { getMatchupWagerInfo, type MatchupWagerInfo } from "@/lib/fantasy/wagers";
import { getLink } from "@/lib/fantasy/link";
import { currentScoringWeek, weekLabel } from "@/lib/fantasy/format";
import { MatchupCard } from "@/components/fantasy/MatchupCard";
import { MatchupWager } from "@/components/fantasy/MatchupWager";
import { Reveal } from "@/components/ui/Reveal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matchups — Whoosh Fantasy" };

type LeagueWeek = {
  leagueId: string;
  leagueName: string;
  season: string;
  matchups: Matchup[];
  wagers: Map<number, MatchupWagerInfo>;
};

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<{ fwager?: string; fmsg?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const sp = await searchParams;
  const banner =
    sp.fwager === "ok"
      ? { tone: "positive", text: "Wager placed — good luck." }
      : sp.fwager === "error"
        ? { tone: "warning", text: sp.fmsg || "Could not place that wager." }
        : null;

  const [configs, link, state] = await Promise.all([
    listActiveLeagues(),
    getLink(session.id).catch(() => null),
    getNflState().catch(() => null),
  ]);
  const week = currentScoringWeek(state);

  const blocks: LeagueWeek[] = (
    await Promise.all(
      // Pools (pick'em/survivor) have no matchups — skip them.
      configs
        .filter((c) => c.kind === "standard")
        .map(async (c) => {
        const season = state?.season ?? c.season;
        const [league, matchups, wagers] = await Promise.all([
          getLeague(c.sleeperLeagueId).catch(() => null),
          getWeekMatchups(c.sleeperLeagueId, week, link?.sleeperUserId).catch(() => []),
          getMatchupWagerInfo(c.sleeperLeagueId, season, week).catch(() => new Map<number, MatchupWagerInfo>()),
        ]);
        return {
          leagueId: c.sleeperLeagueId,
          leagueName: c.name?.trim() || league?.name || "League",
          season,
          matchups,
          wagers,
        };
      }),
    )
  ).filter((b) => b.matchups.length > 0);

  return (
    <main className="ftb-page ftb-page--wide">
      <p className="text-eyebrow">Fantasy · Matchups</p>
      <h1 className="text-h1 ftb-mt-1">{state ? weekLabel(state) : "Matchups"}</h1>

      {banner && (
        <div className={`alert alert-${banner.tone} ftb-mt`}>
          <span className="text-body-sm">{banner.text}</span>
        </div>
      )}

      {blocks.length === 0 ? (
        <Reveal direction="right" className="ftb-mt-lg">
        <div className="card ftb-empty">
          No matchups to show right now. They&apos;ll appear here once the week&apos;s slate is set.
        </div>
        </Reveal>
      ) : (
        blocks.map((b) => (
          <Reveal key={b.leagueId} direction="right" className="ftb-mt-lg">
          <section>
            <h2 className="text-h2 ftb-section-title">{b.leagueName}</h2>
            <div className="ftb-stack">
              {b.matchups.map((m, i) => {
                const wager = m.matchupId != null ? b.wagers.get(m.matchupId) : undefined;
                return (
                  <MatchupCard
                    key={m.matchupId ?? `bye-${i}`}
                    matchup={m}
                    footer={
                      wager && m.away ? (
                        <MatchupWager
                          info={wager}
                          homeTeam={m.home.teamName}
                          awayTeam={m.away.teamName}
                          next="/fantasy/matchups"
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          </section>
          </Reveal>
        ))
      )}
    </main>
  );
}
