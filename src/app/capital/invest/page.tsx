import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { ensureWallet, getBalance } from "@/lib/wb/ledger";
import { getPositions, getRecentOrders, type Position } from "@/lib/wb/invest";
import { getStockSnapshot, RANGE_OPTIONS, type RangeKey } from "@/lib/wb/history";
import { getCompanyProfile } from "@/lib/wb/profile";
import { getQuote } from "@/lib/wb/quotes";
import { getWatchlist, isWatching } from "@/lib/wb/watchlist";
import { StockHeader } from "@/components/wb/StockHeader";
import { StockPriceChart } from "@/components/wb/StockPriceChart";
import { StockStats } from "@/components/wb/StockStats";
import { SymbolSearch } from "@/components/wb/SymbolSearch";
import { Disclaimer } from "@/components/Disclaimer";
import { Ticker } from "@/components/ui/Ticker";
import { Reveal } from "@/components/ui/Reveal";
import { SuccessCheck } from "@/components/ui/SuccessCheck";
import { formatWb, formatUsd } from "@/lib/wb/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invest — Whoosh" };

const fmtWb = formatWb;
const fmtUsd = formatUsd;

function fmtShares(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

type PositionRow = Position & {
  marketPriceCents: number | null;
  marketValueCents: number | null;
  unrealizedCents: number | null;
};

async function enrichPositions(positions: Position[]): Promise<PositionRow[]> {
  return Promise.all(
    positions.map(async (p): Promise<PositionRow> => {
      const q = await getQuote(p.symbol).catch(() => null);
      if (!q) {
        return { ...p, marketPriceCents: null, marketValueCents: null, unrealizedCents: null };
      }
      const mv = Math.round(p.shares * q.priceCents);
      return { ...p, marketPriceCents: q.priceCents, marketValueCents: mv, unrealizedCents: mv - p.costBasisCents };
    }),
  );
}

function isRangeKey(s: string): s is RangeKey {
  return RANGE_OPTIONS.some((r) => r.key === s);
}

export default async function InvestPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; error?: string; symbol?: string; range?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/capital/invest");
  await ensureWallet(session.id, session.username);

  const sp = await searchParams;
  const lookupSymbol = (sp.symbol ?? "").toUpperCase().trim();
  const range: RangeKey = sp.range && isRangeKey(sp.range) ? sp.range : "1y";

  const [balance, positionsRaw, orders, snapshot, profile, watchlistRaw, watching] =
    await Promise.all([
      getBalance(session.id),
      getPositions(session.id),
      getRecentOrders(session.id, 10),
      lookupSymbol ? getStockSnapshot(lookupSymbol, range).catch(() => null) : Promise.resolve(null),
      lookupSymbol ? getCompanyProfile(lookupSymbol).catch(() => null) : Promise.resolve(null),
      getWatchlist(session.id).catch(() => []),
      lookupSymbol ? isWatching(session.id, lookupSymbol).catch(() => false) : Promise.resolve(false),
    ]);

  const watchlist = await Promise.all(
    watchlistRaw.map(async (w) => {
      const q = await getQuote(w.symbol).catch(() => null);
      return { ...w, priceCents: q?.priceCents ?? null };
    }),
  );
  const positions = await enrichPositions(positionsRaw);

  const portfolioValue = positions.reduce((acc, p) => acc + (p.marketValueCents ?? p.costBasisCents), 0);
  const totalEquity = balance + portfolioValue;

  const banner =
    sp.order === "ok" ? { tone: "good", text: "Order filled." } : sp.error ? { tone: "warn", text: sp.error } : null;

  const existingPosition = lookupSymbol ? positions.find((p) => p.symbol === lookupSymbol) : undefined;
  const refLineCents =
    existingPosition && existingPosition.shares > 0
      ? Math.round(existingPosition.costBasisCents / existingPosition.shares)
      : null;

  const livePriceCents =
    snapshot?.regularMarketPriceCents ?? snapshot?.candles[snapshot.candles.length - 1]?.closeCents ?? null;

  let rangeChangeCents: number | null = null;
  let rangeChangePct: number | null = null;
  if (snapshot && snapshot.candles.length >= 2) {
    const first = snapshot.candles[0].closeCents;
    const last = snapshot.candles[snapshot.candles.length - 1].closeCents;
    rangeChangeCents = last - first;
    rangeChangePct = (rangeChangeCents / first) * 100;
  }

  return (
    <main className="cap-page cap-page--wide">
      <p className="text-eyebrow">Capital · Invest</p>
      <h1 className="text-h1 cap-mt-1">Simulated investing</h1>

      {banner && (
        <div className={`alert ${banner.tone === "good" ? "alert-positive" : "alert-warning t-input is-shaking"} cap-mt`}>
          {banner.tone === "good" && <SuccessCheck />}
          <div className="body">{banner.text}</div>
        </div>
      )}

      {/* KPI strip — three compact columns in one card (matches the wallet). */}
      <Reveal direction="right" className="cap-mt">
      <section className="card cap-stat-row">
        <div className="cap-stat">
          <span className="cap-stat__label">Total equity</span>
          <span className="cap-stat__value"><Ticker valueCents={totalEquity} /></span>
          <span className="cap-stat__delta">Cash + positions</span>
        </div>
        <div className="cap-stat">
          <span className="cap-stat__label">Cash (WB)</span>
          <span className="cap-stat__value"><Ticker valueCents={balance} /></span>
          <span className="cap-stat__delta">Available to invest</span>
        </div>
        <div className="cap-stat">
          <span className="cap-stat__label">Positions value</span>
          <span className="cap-stat__value"><Ticker valueCents={portfolioValue} /></span>
          <span className="cap-stat__delta">{positions.length} held</span>
        </div>
      </section>
      </Reveal>

      {/* Asset lookup */}
      <Reveal direction="right" className="cap-mt-lg">
      <section className="card">
        <h2 className="text-h3">Look up an asset</h2>
        <p className="text-body-sm cap-mt-1">
          Search any US-listed stock or supported crypto by company name or ticker. Orders fill at the
          most recent quote — Whoosh Bucks only.
        </p>
        <div className="cap-mt">
          <SymbolSearch defaultValue={lookupSymbol} />
        </div>
      </section>
      </Reveal>

      {/* Stock detail */}
      {lookupSymbol && snapshot && (
        <Reveal direction="right" className="cap-mt-lg">
        <section className="cap-stack">
          <StockHeader profile={profile} snapshot={snapshot} />

          {/* Chart */}
          <div className="chart-card">
            <div className="chart-card__head">
              <div>
                <h3 className="text-h3">Price history</h3>
                {rangeChangeCents != null && rangeChangePct != null && (
                  <p className="text-body-sm cap-mt-1">
                    <span style={{ color: rangeChangeCents >= 0 ? "var(--positive-text)" : "var(--negative-text)", fontFamily: "var(--font-mono)" }}>
                      {rangeChangeCents >= 0 ? "▲ " : "▼ "}
                      {fmtUsd(rangeChangeCents, { signed: true })} ({fmtPct(rangeChangePct)})
                    </span>{" "}
                    over {RANGE_OPTIONS.find((r) => r.key === range)?.label}
                  </p>
                )}
              </div>
              <div className="cap-tabs" style={{ marginTop: 0 }}>
                {RANGE_OPTIONS.map((r) => (
                  <Link
                    key={r.key}
                    href={`/capital/invest?symbol=${encodeURIComponent(lookupSymbol)}&range=${r.key}`}
                    className={`cap-tab ${r.key === range ? "is-active" : ""}`}
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            </div>
            <StockPriceChart
              candles={snapshot.candles}
              refLineCents={refLineCents}
              refLineLabel={refLineCents ? `Your cost ${fmtUsd(refLineCents)}` : undefined}
            />
          </div>

          {/* Trade panel */}
          <div className="card">
            <div className="cap-card-head">
              <h3 className="text-h3">Trade {snapshot.symbol}</h3>
              <form action="/api/wb/watchlist" method="POST">
                <input type="hidden" name="symbol" value={snapshot.symbol} />
                <input type="hidden" name="action" value={watching ? "remove" : "add"} />
                <button type="submit" className="btn btn-secondary btn-sm" aria-label={watching ? "Remove from watchlist" : "Add to watchlist"}>
                  {watching ? "★ Watching" : "☆ Watch"}
                </button>
              </form>
            </div>
            <p className="text-body-sm cap-mt-1">
              Filling at <strong className="num">{livePriceCents != null ? fmtUsd(livePriceCents) : "—"}</strong>/share
              {existingPosition ? (
                <>
                  {" · "}You own <strong>{fmtShares(existingPosition.shares)} {snapshot.symbol}</strong> at{" "}
                  <strong className="num">{fmtWb(Math.round(existingPosition.costBasisCents / existingPosition.shares))}</strong>/share
                </>
              ) : null}
            </p>
            <form action="/api/wb/invest/order" method="POST" className="cap-trade cap-mt">
              <input type="hidden" name="symbol" value={snapshot.symbol} />
              <select name="side" className="input" defaultValue="buy" aria-label="Side">
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
              <div className="input-group">
                <span className="addon">$</span>
                <input className="input input-num" type="number" name="amount" min="0.01" step="0.01" placeholder="USD" inputMode="decimal" />
              </div>
              <input className="input input-num" type="number" name="shares" step="0.000001" min="0" placeholder="or shares" inputMode="decimal" />
              <button type="submit" className="btn btn-primary">Place</button>
            </form>
            <p className="text-caption cap-mt-1">Enter a dollar amount or a share count — share count wins if both are given.</p>
          </div>

          <StockStats snapshot={snapshot} profile={profile} />
        </section>
        </Reveal>
      )}

      {lookupSymbol && !snapshot && (
        <Reveal direction="right" className="cap-mt-lg">
        <div className="card cap-empty">
          No data available for {lookupSymbol}. Try a different US-listed ticker symbol.
        </div>
        </Reveal>
      )}

      {/* Watchlist */}
      {watchlist.length > 0 && (
        <Reveal direction="right" className="cap-mt-lg">
        <section>
          <h2 className="text-h2 cap-section-title">Watchlist</h2>
          <table className="tbl">
            <thead>
              <tr><th>Symbol</th><th className="num">Price</th><th></th></tr>
            </thead>
            <tbody>
              {watchlist.map((w) => (
                <tr key={w.symbol}>
                  <td>
                    <Link href={`/capital/invest?symbol=${encodeURIComponent(w.symbol)}`} className="cap-row__main">{w.symbol}</Link>
                  </td>
                  <td className="num">{w.priceCents != null ? fmtUsd(w.priceCents) : "—"}</td>
                  <td className="num">
                    <form action="/api/wb/watchlist" method="POST">
                      <input type="hidden" name="symbol" value={w.symbol} />
                      <input type="hidden" name="action" value="remove" />
                      <button type="submit" className="btn btn-ghost btn-sm" aria-label={`Remove ${w.symbol}`}>Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        </Reveal>
      )}

      {/* Positions */}
      <Reveal direction="right" className="cap-mt-lg">
      <section>
        <h2 className="text-h2 cap-section-title">Positions</h2>
        {positions.length === 0 ? (
          <div className="card cap-empty">
            No positions yet. Look up a symbol above to get started.
            <div className="cap-tabs" style={{ justifyContent: "center" }}>
              {["AAPL", "TSLA", "NVDA", "MSFT", "BTC"].map((s) => (
                <Link key={s} href={`/capital/invest?symbol=${s}`} className="cap-tab">{s}</Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="cap-tbl-scroll">
          <table className="tbl cap-tbl--tight">
            <thead>
              <tr><th>Symbol</th><th className="num">Shares</th><th className="num">Market value</th><th className="num">P/L</th></tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const u = p.unrealizedCents;
                const cls = u == null ? "" : u > 0 ? "num--positive" : u < 0 ? "num--negative" : "";
                return (
                  <tr key={p.symbol}>
                    <td><Link href={`/capital/invest?symbol=${encodeURIComponent(p.symbol)}`} className="cap-row__main">{p.symbol}</Link></td>
                    <td className="num">{fmtShares(p.shares)}</td>
                    <td className="num">{p.marketValueCents != null ? fmtWb(p.marketValueCents) : "—"}</td>
                    <td className={`num ${cls}`}>
                      {u == null ? "—" : `${u > 0 ? "▲ " : u < 0 ? "▼ " : ""}${fmtWb(u, { signed: true })}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </section>
      </Reveal>

      {/* Total unrealized P/L */}
      {positions.length > 0 && (() => {
        const totalPL = positions.reduce((acc, p) => acc + (p.unrealizedCents ?? 0), 0);
        const totalCost = positions.reduce((acc, p) => acc + p.costBasisCents, 0);
        const pct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
        const pos = totalPL >= 0;
        return (
          <Reveal direction="right" className="cap-mt">
          <div className="kpi">
            <div className="kpi__label">Total unrealized P/L</div>
            <div className="kpi__value" style={{ color: pos ? "var(--positive-text)" : "var(--negative-text)" }}>
              {pos ? "▲ " : "▼ "}{fmtWb(totalPL, { signed: true })}
            </div>
            <div className={`kpi__delta ${pos ? "kpi__delta--positive" : "kpi__delta--negative"}`}>
              {pos ? "+" : ""}{pct.toFixed(2)}%
            </div>
          </div>
          </Reveal>
        );
      })()}

      {/* Recent orders */}
      <Reveal direction="right" className="cap-mt-lg">
      <section>
        <h2 className="text-h2 cap-section-title">Recent orders</h2>
        {orders.length === 0 ? (
          <p className="text-body-sm">No orders yet.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Order</th><th>When</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.side === "buy" ? "Bought" : "Sold"} {fmtShares(o.shares)} {o.symbol} @ {fmtUsd(o.priceCents)}</td>
                  <td className="text-body-sm">{new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</td>
                  <td className={`num ${o.side === "buy" ? "num--negative" : "num--positive"}`}>
                    {o.side === "buy" ? "−" : "+"}{fmtWb(o.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      </Reveal>

      <Disclaimer />
    </main>
  );
}
