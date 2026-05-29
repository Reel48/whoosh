import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { searchPlayers } from "@/lib/sleeper/players";
import { getTrendingWithNames } from "@/lib/fantasy/trending";
import { TrendingPlayers } from "@/components/fantasy/TrendingPlayers";
import { PlayerSearch } from "@/components/fantasy/PlayerSearch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Players — Whoosh Fantasy" };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const sp = await searchParams;
  const query = (sp.q ?? "").trim();

  const [results, trendingAdd, trendingDrop] = await Promise.all([
    query ? searchPlayers(query, 25).catch(() => []) : Promise.resolve([]),
    getTrendingWithNames("add", 12),
    getTrendingWithNames("drop", 12),
  ]);

  return (
    <main className="ftb-page ftb-page--wide">
      <p className="text-eyebrow">Fantasy · Players</p>
      <h1 className="text-h1 ftb-mt-1">Players</h1>

      <section className="card ftb-mt-lg">
        <h2 className="text-h3">Search players</h2>
        <div className="ftb-mt">
          <PlayerSearch defaultValue={query} />
        </div>

        {query && (
          <div className="ftb-mt">
            {results.length === 0 ? (
              <p className="text-body-sm">
                No players match &ldquo;{query}&rdquo;. The index refreshes daily.
              </p>
            ) : (
              <div className="ftb-tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Pos</th>
                      <th>Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((p) => (
                      <tr key={p.playerId}>
                        <td className="font-semibold">{p.fullName}</td>
                        <td>{p.position ?? "—"}</td>
                        <td>{p.team ?? "FA"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="ftb-mt-lg">
        <h2 className="text-h2 ftb-section-title">Trending (last 24h)</h2>
        <div className="ftb-cols">
          <TrendingPlayers title="Most added" rows={trendingAdd} tone="add" />
          <TrendingPlayers title="Most dropped" rows={trendingDrop} tone="drop" />
        </div>
      </section>
    </main>
  );
}
