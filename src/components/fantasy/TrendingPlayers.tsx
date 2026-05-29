import type { PlayerInfo } from "@/lib/sleeper/players";

export type TrendingRow = { player: PlayerInfo; count: number };

function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Trending adds or drops over the last 24h (from Sleeper). */
export function TrendingPlayers({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: TrendingRow[];
  tone: "add" | "drop";
}) {
  return (
    <div className="card">
      <h3 className="text-h3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-body-sm ftb-mt-sm">No trending data right now.</p>
      ) : (
        <div className="ftb-mt-sm">
          {rows.map(({ player, count }) => (
            <div key={player.playerId} className="roster-row">
              <span className="flex min-w-0 items-center gap-2">
                <span className="roster-pos">{player.position ?? "—"}</span>
                <span className="truncate font-semibold">{player.fullName}</span>
                <span className="text-caption">{player.team ?? "FA"}</span>
              </span>
              <span className={`num font-display font-bold ${tone === "add" ? "num--positive" : "num--negative"}`}>
                {tone === "add" ? "+" : "−"}
                {fmtCount(count)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
