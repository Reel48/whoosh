import Link from "next/link";
import type { PoolSummary } from "@/lib/fantasy/pools";

const KIND_LABEL: Record<string, string> = {
  pickem: "Pick 'Em",
  survivor: "Survivor",
};

/** Summary card for a Pick 'Em / Survivor pool on the Overview + Leagues grid. */
export function PoolCard({ pool }: { pool: PoolSummary }) {
  return (
    <Link href={`/fantasy/pools/${pool.config.sleeperLeagueId}`} className="ftb-card-link">
      <div className="card">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-h3 truncate">{pool.displayName}</h3>
          <span className="badge badge-accent shrink-0">{KIND_LABEL[pool.kind] ?? "Pool"}</span>
        </div>
        <p className="text-body-sm ftb-mt-sm">
          {pool.kind === "survivor"
            ? `${pool.aliveCount ?? pool.totalEntries} of ${pool.totalEntries} still alive`
            : `${pool.totalEntries} ${pool.totalEntries === 1 ? "player" : "players"}`}
        </p>
        <span className="ftb-link ftb-mt-sm inline-block">View pool →</span>
      </div>
    </Link>
  );
}
