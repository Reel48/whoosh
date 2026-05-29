import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { ensureWallet } from "@/lib/wb/ledger";
import { listUserWagers, type WagerStatus } from "@/lib/wb/bets";
import { MARKET_LABELS } from "@/lib/wb/odds";
import { LocalTime } from "@/components/LocalTime";
import { Disclaimer } from "@/components/Disclaimer";
import { formatWb } from "@/lib/wb/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "My bets — Whoosh" };

const FILTERS: { key: string; label: string; match: (s: WagerStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "open", label: "Open", match: (s) => s === "open" },
  { key: "won", label: "Won", match: (s) => s === "won" },
  { key: "lost", label: "Lost", match: (s) => s === "lost" },
  { key: "refunded", label: "Pushes", match: (s) => s === "refunded" },
];

const BADGE: Record<WagerStatus, string> = {
  open: "badge-info",
  won: "badge-positive",
  lost: "badge-negative",
  refunded: "badge-neutral",
};
const LABEL: Record<WagerStatus, string> = { open: "Open", won: "Won", lost: "Lost", refunded: "Push" };

export default async function MyBetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord?next=/capital/bets");
  await ensureWallet(session.id, session.username);

  const wagers = await listUserWagers(session.id);
  const sp = await searchParams;

  const open = wagers.filter((w) => w.status === "open");
  const won = wagers.filter((w) => w.status === "won");
  const lost = wagers.filter((w) => w.status === "lost");
  const settled = wagers.filter((w) => w.status !== "open");
  const atStake = open.reduce((a, w) => a + w.stakeCents, 0);
  const netCents = settled.reduce((a, w) => a + (w.payoutCents - w.stakeCents), 0);
  const netPos = netCents >= 0;

  const activeFilter = FILTERS.find((f) => f.key === sp.status) ?? FILTERS[0];
  const visible = wagers.filter((w) => activeFilter.match(w.status));

  return (
    <main className="cap-page">
      <p className="text-eyebrow">Capital · My bets</p>
      <h1 className="text-h1 cap-mt-1">My bets</h1>
      <p className="text-body-sm cap-mt-1">Your open wagers and full win/loss history.</p>

      {/* Summary */}
      <section className="card-grid cap-mt">
        <div className="kpi">
          <div className="kpi__label">Open</div>
          <div className="kpi__value">{open.length}</div>
          <div className="kpi__delta">{open.length > 0 ? `${formatWb(atStake)} at stake` : "Nothing live"}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Record</div>
          <div className="kpi__value">{won.length}–{lost.length}</div>
          <div className="kpi__delta">Won–Lost</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Net P/L · settled</div>
          <div className="kpi__value" style={{ color: netPos ? "var(--positive-text)" : "var(--negative-text)" }}>
            {netPos ? "▲ " : "▼ "}{formatWb(netCents, { signed: true })}
          </div>
          <div className={`kpi__delta ${netPos ? "kpi__delta--positive" : "kpi__delta--negative"}`}>All settled bets</div>
        </div>
      </section>

      {/* Filters */}
      <div className="cap-tabs">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/capital/bets" : `/capital/bets?status=${f.key}`}
            className={`cap-tab ${activeFilter.key === f.key ? "is-active" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="card cap-mt-lg cap-empty">
          {wagers.length === 0 ? (
            <>No bets yet. Head to <Link href="/capital/events" className="cap-link">Events</Link> to place your first wager.</>
          ) : (
            "Nothing here. Try a different filter."
          )}
        </div>
      ) : (
        <div className="cap-tbl-scroll cap-mt-lg">
        <table className="tbl">
          <thead>
            <tr>
              <th>Bet</th>
              <th className="num">Stake</th>
              <th className="num">Return</th>
              <th className="num">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((w) => {
              const marketLabel = w.event.market ? MARKET_LABELS[w.event.market] : null;
              const profitCents = w.payoutCents - w.stakeCents;
              let returnNode: React.ReactNode;
              let returnCls = "";
              if (w.status === "open") {
                returnNode = formatWb(w.potentialCents);
              } else if (w.status === "won") {
                returnNode = `${formatWb(w.payoutCents)} (${formatWb(profitCents, { signed: true })})`;
                returnCls = "num--positive";
              } else if (w.status === "lost") {
                returnNode = formatWb(-w.stakeCents, { signed: true });
                returnCls = "num--negative";
              } else {
                returnNode = formatWb(w.payoutCents);
              }
              return (
                <tr key={w.id}>
                  <td>
                    <div className="cap-row__main">{w.event.title}{marketLabel ? ` · ${marketLabel}` : ""}</div>
                    <div className="text-caption">
                      {w.outcomeLabel} ×{w.oddsFrozen.toFixed(2)} · <LocalTime iso={w.createdAt} options={{ year: "numeric" }} />
                    </div>
                  </td>
                  <td className="num">{formatWb(w.stakeCents)}</td>
                  <td className={`num ${returnCls}`}>{returnNode}</td>
                  <td className="num">
                    <span className={`badge ${BADGE[w.status]}`}>{LABEL[w.status]}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      <Disclaimer />
    </main>
  );
}
