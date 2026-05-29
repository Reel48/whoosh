import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getNflState } from "@/lib/sleeper/client";
import { listActiveLeagues, getLeagueOverview, type LeagueOverview } from "@/lib/fantasy/leagues";
import { getCrossLeagueScoreboard } from "@/lib/fantasy/rankings";
import { getLink } from "@/lib/fantasy/link";
import { LeagueCard } from "@/components/fantasy/LeagueCard";
import { CrossLeagueTable } from "@/components/fantasy/CrossLeagueTable";
import { LinkSleeperForm } from "@/components/fantasy/LinkSleeperForm";
import { weekLabel } from "@/lib/fantasy/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fantasy — Whoosh" };

export default async function FantasyHome({
  searchParams,
}: {
  searchParams: Promise<{ flink?: string; fmsg?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const sp = await searchParams;
  const banner =
    sp.flink === "ok"
      ? { tone: "positive", text: "Sleeper account linked." }
      : sp.flink === "unlinked"
        ? { tone: "info", text: "Sleeper account unlinked." }
        : sp.flink === "error"
          ? { tone: "warning", text: sp.fmsg || "Could not link that account." }
          : null;

  const [state, leagueConfigs, link, board] = await Promise.all([
    getNflState().catch(() => null),
    listActiveLeagues(),
    getLink(session.id).catch(() => null),
    getCrossLeagueScoreboard().catch(() => ({ rows: [], leagues: [] })),
  ]);

  const overviews = (
    await Promise.all(
      leagueConfigs.map((c) => getLeagueOverview(c.sleeperLeagueId).catch(() => null)),
    )
  ).filter((o): o is LeagueOverview => o !== null);

  const mineRosterId = (o: LeagueOverview): number | null =>
    link ? o.standings.find((s) => s.ownerId === link.sleeperUserId)?.rosterId ?? null : null;

  return (
    <main className="ftb-page ftb-page--wide">
      <header className="ftb-welcome">
        <div className="ftb-welcome__name">
          <p className="text-eyebrow">Fantasy Football</p>
          <h1 className="text-h1">@{session.username}</h1>
        </div>
        {state && <span className="badge badge-accent">{weekLabel(state)}</span>}
      </header>

      {banner && (
        <div className={`alert alert-${banner.tone} ftb-mt`}>
          <span className="text-body-sm">{banner.text}</span>
        </div>
      )}

      {/* Link prompt / status */}
      {!link ? (
        <section className="card ftb-mt-lg">
          <h2 className="text-h3">Link your Sleeper account</h2>
          <p className="text-body-sm ftb-mt-1">
            Connect your Sleeper username to highlight your team in the standings and power rankings.
          </p>
          <div className="ftb-mt">
            <LinkSleeperForm />
          </div>
        </section>
      ) : (
        <div className="ftb-mt flex flex-wrap items-center gap-3">
          <span className="text-body-sm">
            Linked as <strong>@{link.sleeperUsername}</strong>
          </span>
          <form action="/api/fantasy/link" method="POST">
            <input type="hidden" name="action" value="unlink" />
            <input type="hidden" name="next" value="/fantasy" />
            <button type="submit" className="btn btn-ghost btn-sm">
              Unlink
            </button>
          </form>
        </div>
      )}

      {/* Who's leading */}
      <section className="ftb-mt-lg">
        <div className="ftb-card-head">
          <h2 className="text-h2">Who&apos;s leading</h2>
          <Link href="/fantasy/leagues" className="ftb-link">
            All leagues →
          </Link>
        </div>
        {overviews.length === 0 ? (
          <div className="card ftb-mt ftb-empty">
            No leagues yet. An admin can add Whoosh leagues from the admin panel.
          </div>
        ) : (
          <div className="ftb-league-grid ftb-mt">
            {overviews.map((o) => (
              <LeagueCard key={o.config.sleeperLeagueId} overview={o} mineRosterId={mineRosterId(o)} />
            ))}
          </div>
        )}
      </section>

      {/* Cross-league power rankings preview */}
      {board.rows.length > 0 && (
        <section className="ftb-mt-lg">
          <div className="ftb-card-head">
            <h2 className="text-h2">Power rankings</h2>
            <Link href="/fantasy/rankings" className="ftb-link">
              Full rankings →
            </Link>
          </div>
          <p className="text-body-sm ftb-mt-1">
            Every team across all Whoosh leagues, ranked by a blend of record and points scored.
          </p>
          <div className="ftb-mt">
            <CrossLeagueTable
              rows={board.rows.slice(0, 5)}
              mineSleeperUserId={link?.sleeperUserId}
              compact
            />
          </div>
        </section>
      )}
    </main>
  );
}
