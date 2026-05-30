import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getPoolDetail } from "@/lib/fantasy/pools";
import { TeamAvatar } from "@/components/fantasy/TeamAvatar";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { pickem: "Pick 'Em", survivor: "Survivor" };

export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const { leagueId } = await params;
  const pool = await getPoolDetail(leagueId).catch(() => null);
  if (!pool) notFound();

  const isSurvivor = pool.kind === "survivor";

  return (
    <main className="ftb-page ftb-page--wide">
      <Link href="/fantasy/leagues" className="ftb-link">
        ← All leagues
      </Link>

      <header className="ftb-welcome ftb-mt-sm">
        <div className="ftb-welcome__name">
          <p className="text-eyebrow">Fantasy · {KIND_LABEL[pool.kind] ?? "Pool"}</p>
          <h1 className="text-h1">{pool.displayName}</h1>
        </div>
        <span className="badge badge-accent">{KIND_LABEL[pool.kind] ?? "Pool"}</span>
      </header>

      {/* Summary + link out — picks/standings live on Sleeper. */}
      <section className="card ftb-mt-lg">
        <div className="ftb-card-head">
          <div>
            <p className="text-eyebrow">{pool.season} season</p>
            <p className="text-h3 ftb-mt-1">
              {isSurvivor
                ? `${pool.aliveCount ?? pool.totalEntries} of ${pool.totalEntries} still alive`
                : `${pool.totalEntries} ${pool.totalEntries === 1 ? "player" : "players"}`}
            </p>
          </div>
          <a href={pool.sleeperUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Open in Sleeper ↗
          </a>
        </div>
        <p className="text-body-sm ftb-mt">
          {isSurvivor
            ? "Make your weekly pick on Sleeper — survive the week and you advance. Eliminations show up here."
            : "Make and track your weekly picks on Sleeper. Standings live there too."}
        </p>
      </section>

      {/* Entries */}
      <section className="ftb-mt-lg">
        <h2 className="text-h2 ftb-section-title">{isSurvivor ? "Entries" : "Players"}</h2>
        {pool.entries.length === 0 ? (
          <div className="card ftb-empty">No entries yet.</div>
        ) : (
          <div className="ftb-tbl-scroll">
            <table className="standings">
              <thead>
                <tr>
                  <th>{isSurvivor ? "Entry" : "Player"}</th>
                  {isSurvivor && <th className="num">Status</th>}
                </tr>
              </thead>
              <tbody>
                {pool.entries.map((e) => (
                  <tr key={e.rosterId}>
                    <td>
                      <span className="team-cell">
                        <TeamAvatar url={e.avatarUrl} name={e.name} size={32} />
                        <span className="min-w-0">
                          <span className="name">{e.name}</span>
                          <span className="owner">@{e.ownerName}</span>
                        </span>
                      </span>
                    </td>
                    {isSurvivor && (
                      <td className="num">
                        {e.eliminated ? (
                          <span className="badge badge-loss">Out</span>
                        ) : (
                          <span className="badge badge-win">Alive</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
