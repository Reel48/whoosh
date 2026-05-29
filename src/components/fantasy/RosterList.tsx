import type { RosterDetail } from "@/lib/fantasy/leagues";
import type { PlayerInfo } from "@/lib/sleeper/players";

function PlayerRow({ p }: { p: PlayerInfo }) {
  return (
    <div className="roster-row">
      <span className="flex min-w-0 items-center gap-2">
        <span className="roster-pos">{p.position ?? "—"}</span>
        <span className="truncate font-semibold">{p.fullName}</span>
      </span>
      <span className="text-caption">{p.team ?? "FA"}</span>
    </div>
  );
}

/** A team's roster — starters first, then bench. */
export function RosterList({ roster }: { roster: RosterDetail }) {
  return (
    <div className="card">
      <h3 className="text-h3">{roster.teamName}</h3>
      {roster.starters.length === 0 && roster.bench.length === 0 ? (
        <p className="text-body-sm ftb-mt-sm">No roster data.</p>
      ) : (
        <>
          {roster.starters.length > 0 && (
            <>
              <p className="text-eyebrow ftb-mt-sm">Starters</p>
              {roster.starters.map((p, i) => (
                <PlayerRow key={`${p.playerId}-${i}`} p={p} />
              ))}
            </>
          )}
          {roster.bench.length > 0 && (
            <>
              <p className="text-eyebrow ftb-mt">Bench</p>
              {roster.bench.map((p, i) => (
                <PlayerRow key={`${p.playerId}-${i}`} p={p} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
