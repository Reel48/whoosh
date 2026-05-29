import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCrossLeagueScoreboard, POWER_WEIGHTS } from "@/lib/fantasy/rankings";
import { getLink } from "@/lib/fantasy/link";
import { CrossLeagueTable } from "@/components/fantasy/CrossLeagueTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Power Rankings — Whoosh Fantasy" };

export default async function RankingsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const [board, link] = await Promise.all([
    getCrossLeagueScoreboard(),
    getLink(session.id).catch(() => null),
  ]);

  return (
    <main className="ftb-page ftb-page--wide">
      <p className="text-eyebrow">Fantasy · Power Rankings</p>
      <h1 className="text-h1 ftb-mt-1">Cross-league power rankings</h1>
      <p className="text-body-sm ftb-mt">
        Every team across {board.leagues.length === 1 ? "the league" : `all ${board.leagues.length} leagues`} in
        one table. Power Score blends winning ({Math.round(POWER_WEIGHTS.record * 100)}%) and points scored
        ({Math.round(POWER_WEIGHTS.points * 100)}%); ties break by league finish, then total points.
      </p>

      <section className="ftb-mt-lg">
        <CrossLeagueTable rows={board.rows} mineSleeperUserId={link?.sleeperUserId} />
      </section>
    </main>
  );
}
