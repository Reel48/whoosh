import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { ensureWallet, queryLedger, type LedgerKind } from "@/lib/wb/ledger";
import { Disclaimer } from "@/components/Disclaimer";
import { formatWb } from "@/lib/wb/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity — Whoosh" };

const KIND_GROUPS: { label: string; kinds: LedgerKind[] }[] = [
  { label: "Purchases", kinds: ["purchase", "premium_match"] },
  { label: "Interest", kinds: ["interest"] },
  { label: "Transfers", kinds: ["transfer_in", "transfer_out"] },
  { label: "Investing", kinds: ["invest_buy", "invest_sell", "invest_dividend"] },
  { label: "Wagers", kinds: ["bet_stake", "bet_payout"] },
  { label: "Bonuses", kinds: ["daily_bonus", "referral_reward"] },
  { label: "Adjustments", kinds: ["adjustment"] },
];

const ALL_KINDS = KIND_GROUPS.flatMap((g) => g.kinds);

const KIND_LABEL: Record<LedgerKind, string> = {
  purchase: "Purchase",
  premium_match: "Premium match",
  fantasy_match: "Fantasy match",
  interest: "Interest",
  transfer_in: "Received",
  transfer_out: "Sent",
  bet_stake: "Bet placed",
  bet_payout: "Bet payout",
  invest_buy: "Buy",
  invest_sell: "Sell",
  invest_dividend: "Dividend",
  daily_bonus: "Daily check-in",
  referral_reward: "Referral reward",
  adjustment: "Adjustment",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; since?: string; until?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/capital/wallet/activity");
  await ensureWallet(session.id, session.username);
  const sp = await searchParams;

  const activeGroupLabel = sp.group ?? "All";
  const group = KIND_GROUPS.find((g) => g.label === sp.group);
  const filterKinds = group ? group.kinds : ALL_KINDS;

  const entries = await queryLedger(session.id, {
    kinds: group ? filterKinds : undefined,
    since: sp.since || undefined,
    until: sp.until || undefined,
    limit: 500,
  });

  const totalCents = entries.reduce((acc, e) => acc + e.amountCents, 0);

  const csvHref = `/api/wb/activity.csv?${new URLSearchParams({
    ...(group ? { group: group.label } : {}),
    ...(sp.since ? { since: sp.since } : {}),
    ...(sp.until ? { until: sp.until } : {}),
  }).toString()}`;

  return (
    <main className="cap-page cap-page--wide">
      <Link href="/capital/wallet" className="cap-link">← Back to wallet</Link>
      <h1 className="text-h1 cap-mt-1">Activity</h1>
      <p className="text-body-sm cap-mt-1">Every ledger entry on your account. Filter, sort by date, export.</p>

      {/* Filter chips */}
      <div className="cap-tabs">
        <Link href="/capital/wallet/activity" className={`cap-tab ${!group ? "is-active" : ""}`}>All</Link>
        {KIND_GROUPS.map((g) => {
          const params = new URLSearchParams();
          params.set("group", g.label);
          if (sp.since) params.set("since", sp.since);
          if (sp.until) params.set("until", sp.until);
          return (
            <Link
              key={g.label}
              href={`/capital/wallet/activity?${params.toString()}`}
              className={`cap-tab ${activeGroupLabel === g.label ? "is-active" : ""}`}
            >
              {g.label}
            </Link>
          );
        })}
      </div>

      {/* Date range */}
      <form action="/capital/wallet/activity" method="GET" className="cap-filterbar cap-mt">
        {group && <input type="hidden" name="group" value={group.label} />}
        <div className="field">
          <label htmlFor="since">From</label>
          <input id="since" className="input" type="date" name="since" defaultValue={sp.since ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="until">To</label>
          <input id="until" className="input" type="date" name="until" defaultValue={sp.until ?? ""} />
        </div>
        <button type="submit" className="btn btn-primary">Apply</button>
        <a href={csvHref} className="btn btn-secondary">Export CSV</a>
      </form>

      {/* Summary */}
      <section className="card-grid cap-mt">
        <div className="kpi">
          <div className="kpi__label">Entries</div>
          <div className="kpi__value">{entries.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Net</div>
          <div className="kpi__value" style={{ color: totalCents >= 0 ? "var(--positive-text)" : "var(--negative-text)" }}>
            {totalCents >= 0 ? "+" : "−"}{formatWb(Math.abs(totalCents))}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Window</div>
          <div className="kpi__value" style={{ fontSize: "var(--fs-h3)" }}>
            {sp.since && sp.until ? `${sp.since} → ${sp.until}` : sp.since ? `from ${sp.since}` : sp.until ? `until ${sp.until}` : "All time"}
          </div>
        </div>
      </section>

      {/* Table */}
      {entries.length === 0 ? (
        <div className="card cap-mt-lg cap-empty">No entries match this filter.</div>
      ) : (
        <table className="tbl cap-mt-lg">
          <thead>
            <tr>
              <th>Type</th>
              <th>When</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const positive = e.amountCents > 0;
              const negative = e.amountCents < 0;
              const cls = positive ? "num--positive" : negative ? "num--negative" : "";
              return (
                <tr key={e.id}>
                  <td>
                    <div className="cap-row__main">{KIND_LABEL[e.kind] ?? e.kind}</div>
                    {e.memo && <div className="text-caption">{e.memo}</div>}
                  </td>
                  <td className="text-body-sm">{fmtDate(e.createdAt)}</td>
                  <td className={`num ${cls}`}>
                    {positive ? "▲ +" : negative ? "▼ −" : ""}
                    {formatWb(Math.abs(e.amountCents))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Disclaimer />
    </main>
  );
}
