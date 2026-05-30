import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listActiveLeagues, getLeagueOverview, type LeagueOverview } from "@/lib/fantasy/leagues";
import { listPoolSummaries } from "@/lib/fantasy/pools";
import { getLink } from "@/lib/fantasy/link";
import { LeagueCard } from "@/components/fantasy/LeagueCard";
import { PoolCard } from "@/components/fantasy/PoolCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leagues — Whoosh Fantasy" };

export default async function LeaguesPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const [configs, link, pools] = await Promise.all([
    listActiveLeagues(),
    getLink(session.id).catch(() => null),
    listPoolSummaries().catch(() => []),
  ]);

  // H2H leagues get the standings cards; pools render in their own section.
  const overviews = (
    await Promise.all(
      configs
        .filter((c) => c.kind === "standard")
        .map((c) => getLeagueOverview(c.sleeperLeagueId).catch(() => null)),
    )
  ).filter((o): o is LeagueOverview => o !== null);

  const mineRosterId = (o: LeagueOverview): number | null =>
    link ? o.standings.find((s) => s.ownerId === link.sleeperUserId)?.rosterId ?? null : null;

  return (
    <main className="ftb-page ftb-page--wide">
      <p className="text-eyebrow">Fantasy · Leagues</p>
      <h1 className="text-h1 ftb-mt-1">Whoosh leagues</h1>

      {overviews.length === 0 ? (
        <div className="card ftb-mt-lg ftb-empty">
          No leagues are set up yet. Check back once the commissioner adds them.
        </div>
      ) : (
        <div className="ftb-league-grid ftb-mt-lg">
          {overviews.map((o) => (
            <LeagueCard key={o.config.sleeperLeagueId} overview={o} mineRosterId={mineRosterId(o)} />
          ))}
        </div>
      )}

      {pools.length > 0 && (
        <section className="ftb-mt-lg">
          <h2 className="text-h2 ftb-section-title">Pools</h2>
          <div className="ftb-league-grid">
            {pools.map((p) => (
              <PoolCard key={p.config.sleeperLeagueId} pool={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
