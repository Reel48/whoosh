import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { ensureWallet, getBalance } from "@/lib/wb/ledger";
import { getPositions, getRecentOrders, type Position } from "@/lib/wb/invest";
import { getStockSnapshot, RANGE_OPTIONS, type RangeKey } from "@/lib/wb/history";
import { getCompanyProfile } from "@/lib/wb/profile";
import { getQuote } from "@/lib/wb/quotes";
import { getWatchlist, isWatching } from "@/lib/wb/watchlist";
import { Nav } from "@/components/Nav";
import { StockHeader } from "@/components/wb/StockHeader";
import { StockPriceChart } from "@/components/wb/StockPriceChart";
import { StockStats } from "@/components/wb/StockStats";
import { SymbolSearch } from "@/components/wb/SymbolSearch";
import { Disclaimer } from "@/components/Disclaimer";
import { formatWb, formatUsd } from "@/lib/wb/format";
import { CRYPTO_ASSETS } from "@/lib/wb/assets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invest — Whoosh" };

// 1 WB = $1 in our system, so WB and real-USD market values render
// identically as "$X". Separate names keep the currency intent legible
// in code: WB for balances/positions/P/L, USD for stock prices.
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
  // Fan out to the symbol_quote cache (60s TTL) so the user sees live
  // mark-to-market on their own holdings. With the cache hot this is N
  // single-row Postgres reads, not N upstream quote calls.
  return Promise.all(
    positions.map(async (p): Promise<PositionRow> => {
      const q = await getQuote(p.symbol).catch(() => null);
      if (!q) {
        return {
          ...p,
          marketPriceCents: null,
          marketValueCents: null,
          unrealizedCents: null,
        };
      }
      const mv = Math.round(p.shares * q.priceCents);
      return {
        ...p,
        marketPriceCents: q.priceCents,
        marketValueCents: mv,
        unrealizedCents: mv - p.costBasisCents,
      };
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
  if (!session) redirect("/api/auth/discord?next=/invest");
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

  // Pull quotes for watchlist entries so we can show live prices.
  const watchlist = await Promise.all(
    watchlistRaw.map(async (w) => {
      const q = await getQuote(w.symbol).catch(() => null);
      return { ...w, priceCents: q?.priceCents ?? null };
    }),
  );
  const positions = await enrichPositions(positionsRaw);

  const portfolioValue = positions.reduce(
    (acc, p) => acc + (p.marketValueCents ?? p.costBasisCents),
    0,
  );
  const totalEquity = balance + portfolioValue;

  const banner =
    sp.order === "ok"
      ? { tone: "good", text: "Order filled." }
      : sp.error
        ? { tone: "warn", text: sp.error }
        : null;

  // For the trade panel + reference line: existing cost-basis-per-share, if
  // the user already holds this symbol.
  const existingPosition = lookupSymbol
    ? positions.find((p) => p.symbol === lookupSymbol)
    : undefined;
  // Reference line on the price chart shows the user's cost basis per
  // share. cost_basis_cents is stored in WB cents = USD cents (1:1), so
  // it's already on the same scale as the chart's USD price axis.
  const refLineCents =
    existingPosition && existingPosition.shares > 0
      ? Math.round(existingPosition.costBasisCents / existingPosition.shares)
      : null;

  const livePriceCents =
    snapshot?.regularMarketPriceCents ??
    snapshot?.candles[snapshot.candles.length - 1]?.closeCents ??
    null;

  // Range performance (start vs end of the chart range).
  let rangeChangeCents: number | null = null;
  let rangeChangePct: number | null = null;
  if (snapshot && snapshot.candles.length >= 2) {
    const first = snapshot.candles[0].closeCents;
    const last = snapshot.candles[snapshot.candles.length - 1].closeCents;
    rangeChangeCents = last - first;
    rangeChangePct = (rangeChangeCents / first) * 100;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
        <span className="text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink">
          Simulated investing
        </span>

        {/* Header tiles */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Tile label="Total equity" value={fmtWb(totalEquity)} />
          <Tile label="Cash (WB)" value={fmtWb(balance)} />
          <Tile label="Positions value" value={fmtWb(portfolioValue)} />
        </div>

        {banner && (
          <div
            className={`mt-6 rounded-xl border-2 border-ink px-4 py-3 text-sm font-medium ${
              banner.tone === "good"
                ? "bg-pigment-green text-white-smoke"
                : "bg-imperial-red text-white-smoke"
            }`}
          >
            {banner.text}
          </div>
        )}

        {/* Symbol lookup */}
        <section className="mt-8 rounded-3xl border-2 border-ink bg-white-smoke p-6 text-ink sm:p-8">
          <h2 className="font-heading text-xl font-bold">Look up an asset</h2>
          <p className="mt-1 text-sm font-medium text-ink/70">
            Real US stocks (~15 min delayed) and live crypto quotes. Orders
            fill at the most recent quote — Whoosh Bucks only, no real money.
          </p>
          <div className="mt-4">
            <SymbolSearch defaultValue={lookupSymbol} />
          </div>

          {/* Crypto quick-picks */}
          <div className="mt-5">
            <div className="text-xs font-bold uppercase tracking-wider text-ink/60">
              Crypto
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {CRYPTO_ASSETS.map((c) => {
                const isActive = c.symbol === lookupSymbol;
                return (
                  <li key={c.symbol}>
                    <Link
                      href={`/invest?symbol=${c.symbol}`}
                      className={`chip-tap tap-press gap-1.5 rounded-full border-2 border-ink px-4 text-sm font-bold transition-colors ${
                        isActive
                          ? "bg-ink text-white-smoke"
                          : "bg-white-smoke text-ink hover:bg-ink hover:text-white-smoke"
                      }`}
                    >
                      <span className="font-heading font-black">{c.symbol}</span>
                      <span className="opacity-70">· {c.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Stock detail view */}
        {lookupSymbol && snapshot && (
          <section className="mt-8 space-y-6">
            <StockHeader profile={profile} snapshot={snapshot} />

            {/* Chart card */}
            <div className="rounded-3xl border-2 border-ink bg-white-smoke p-6 sm:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h3 className="font-heading text-xl font-bold text-ink">Price history</h3>
                  {rangeChangeCents != null && rangeChangePct != null && (
                    <p className="mt-1 text-sm font-medium">
                      <span
                        className={`font-heading font-black ${
                          rangeChangeCents >= 0 ? "text-pigment-green" : "text-imperial-red"
                        }`}
                      >
                        {rangeChangeCents >= 0 ? "+" : ""}
                        {fmtUsd(rangeChangeCents, { signed: true })} ({fmtPct(rangeChangePct)})
                      </span>{" "}
                      <span className="text-ink/60">
                        over the last {RANGE_OPTIONS.find((r) => r.key === range)?.label}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {RANGE_OPTIONS.map((r) => {
                    const isActive = r.key === range;
                    return (
                      <Link
                        key={r.key}
                        href={`/invest?symbol=${encodeURIComponent(lookupSymbol)}&range=${r.key}`}
                        className={`chip-tap tap-press cursor-pointer rounded-full border-2 border-ink px-4 text-sm font-bold transition-colors ${
                          isActive
                            ? "bg-ink text-white-smoke"
                            : "bg-white-smoke text-ink hover:bg-ink hover:text-white-smoke"
                        }`}
                      >
                        {r.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6">
                <StockPriceChart
                  candles={snapshot.candles}
                  refLineCents={refLineCents}
                  refLineLabel={refLineCents ? `Your cost ${fmtUsd(refLineCents)}` : undefined}
                />
              </div>
            </div>

            {/* Trade panel */}
            <div className="rounded-3xl border-2 border-ink bg-blue p-6 text-ink sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-4">
                <div className="flex items-center justify-between gap-3 sm:contents">
                  <h3 className="font-heading text-xl font-bold">Trade {snapshot.symbol}</h3>
                  <form action="/api/wb/watchlist" method="POST">
                    <input type="hidden" name="symbol" value={snapshot.symbol} />
                    <input type="hidden" name="action" value={watching ? "remove" : "add"} />
                    <button
                      type="submit"
                      className="chip-tap tap-press cursor-pointer rounded-full border-2 border-ink bg-white-smoke px-4 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-white-smoke"
                      aria-label={watching ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      {watching ? "★ Watching" : "☆ Watch"}
                    </button>
                  </form>
                </div>
                <div className="text-sm font-medium text-ink/70">
                  Filling at{" "}
                  <span className="font-heading font-black">
                    {livePriceCents != null ? fmtUsd(livePriceCents) : "—"}
                  </span>
                  <span className="text-ink/60">/share</span>
                </div>
              </div>
              {existingPosition && (
                <p className="mt-2 text-sm font-medium text-ink/80">
                  You own{" "}
                  <span className="font-heading font-bold">
                    {fmtShares(existingPosition.shares)} {snapshot.symbol}
                  </span>{" "}
                  at an avg cost of{" "}
                  <span className="font-heading font-bold">
                    {fmtWb(Math.round(existingPosition.costBasisCents / existingPosition.shares))}
                    /share
                  </span>
                  .
                </p>
              )}
              <form
                action="/api/wb/invest/order"
                method="POST"
                className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <input type="hidden" name="symbol" value={snapshot.symbol} />
                <select
                  name="side"
                  className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-heading font-bold uppercase focus:outline-none focus:ring-2 focus:ring-ink"
                  defaultValue="buy"
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-heading font-bold text-ink/60">
                    $
                  </span>
                  <input
                    type="number"
                    name="amount"
                    min="0.01"
                    step="0.01"
                    placeholder="USD"
                    inputMode="decimal"
                    className="w-full rounded-full border-2 border-ink bg-white-smoke px-3 py-2 pl-7 text-right font-heading font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>
                <input
                  type="number"
                  name="shares"
                  step="0.000001"
                  min="0"
                  placeholder="or shares"
                  inputMode="decimal"
                  className="w-full rounded-full border-2 border-ink bg-white-smoke px-3 py-2 text-right font-heading font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink"
                />
                <button
                  type="submit"
                  className="tap-press cursor-pointer rounded-full border-2 border-ink bg-ink px-5 py-2 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
                >
                  Place
                </button>
              </form>
              <p className="mt-2 text-xs text-ink/70">
                Enter a dollar amount <em>or</em> a share count — share count wins if both are given.
              </p>
            </div>

            <StockStats snapshot={snapshot} profile={profile} />
          </section>
        )}

        {lookupSymbol && !snapshot && (
          <section className="mt-8 rounded-3xl border-2 border-ink bg-white-smoke p-8 text-center">
            <p className="font-heading text-lg font-bold text-ink">
              No data available for {lookupSymbol}.
            </p>
            <p className="mt-2 text-sm font-medium text-ink/70">
              Try a different US-listed ticker symbol.
            </p>
          </section>
        )}

        {/* Watchlist */}
        {watchlist.length > 0 && (
          <section className="mt-12">
            <h2 className="font-heading text-xl font-bold text-ink">Watchlist</h2>
            <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
              {watchlist.map((w) => (
                <li
                  key={w.symbol}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <Link
                    href={`/invest?symbol=${encodeURIComponent(w.symbol)}`}
                    className="tap-press flex-1 min-w-0 font-heading text-lg font-black underline-offset-2 hover:underline sm:text-base"
                  >
                    {w.symbol}
                    <span className="ml-2 font-bold text-ink/70 tabular-nums">
                      {w.priceCents != null ? fmtUsd(w.priceCents) : "—"}
                    </span>
                  </Link>
                  <form action="/api/wb/watchlist" method="POST">
                    <input type="hidden" name="symbol" value={w.symbol} />
                    <input type="hidden" name="action" value="remove" />
                    <button
                      type="submit"
                      aria-label={`Remove ${w.symbol} from watchlist`}
                      className="chip-tap tap-press cursor-pointer rounded-full border-2 border-ink bg-white-smoke px-3 text-xs font-bold text-ink"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Positions */}
        <h2 className="mt-12 font-heading text-xl font-bold text-ink">Positions</h2>
        {positions.length === 0 ? (
          <div className="mt-4 rounded-3xl border-2 border-ink bg-white-smoke p-6 text-center">
            <p className="font-heading text-lg font-bold text-ink">No positions yet.</p>
            <p className="mt-2 text-sm text-ink/60">
              Look up a symbol above to get started — try one of these:
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {["AAPL", "TSLA", "NVDA", "MSFT", "BTC"].map((s) => (
                <Link
                  key={s}
                  href={`/invest?symbol=${s}`}
                  className="chip-tap tap-press rounded-full border-2 border-ink bg-white-smoke px-4 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-white-smoke"
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
            {positions.map((p) => {
              const plPositive = p.unrealizedCents != null && p.unrealizedCents > 0;
              const plNegative = p.unrealizedCents != null && p.unrealizedCents < 0;
              return (
                <li
                  key={p.symbol}
                  className="flex flex-col gap-2 py-3 text-sm sm:grid sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center sm:gap-4"
                >
                  <div className="flex items-baseline justify-between gap-3 sm:block">
                    <Link
                      href={`/invest?symbol=${encodeURIComponent(p.symbol)}`}
                      className="tap-press font-heading text-lg font-black underline-offset-2 hover:underline sm:text-base"
                    >
                      {p.symbol}
                    </Link>
                    <div className="text-xs text-ink/60">{fmtShares(p.shares)} shares</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:contents">
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-bold uppercase tracking-wider text-ink/60">
                        Market
                      </div>
                      <div className="font-heading font-bold tabular-nums">
                        {p.marketValueCents != null ? fmtWb(p.marketValueCents) : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold uppercase tracking-wider text-ink/60">
                        P/L
                      </div>
                      <div
                        className={`font-heading font-black tabular-nums ${
                          plPositive
                            ? "text-pigment-green"
                            : plNegative
                              ? "text-imperial-red"
                              : "text-ink/60"
                        }`}
                        aria-label={
                          p.unrealizedCents != null
                            ? `${plPositive ? "up" : plNegative ? "down" : "flat"} ${fmtWb(p.unrealizedCents, { signed: true })}`
                            : "unavailable"
                        }
                      >
                        {p.unrealizedCents != null
                          ? `${plPositive ? "▲ " : plNegative ? "▼ " : ""}${fmtWb(p.unrealizedCents, { signed: true })}`
                          : "—"}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/invest?symbol=${encodeURIComponent(p.symbol)}`}
                    className="chip-tap tap-press w-full justify-center rounded-full border-2 border-ink bg-white-smoke px-3 text-xs font-bold text-ink sm:w-auto"
                  >
                    Open
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Total portfolio P/L summary */}
        {positions.length > 0 && (
          <div className="mt-6 rounded-2xl border-2 border-ink bg-blue p-5 text-ink">
            <p className="text-xs font-bold uppercase tracking-wider text-ink/70">
              Total unrealized P/L
            </p>
            {(() => {
              const totalPL = positions.reduce(
                (acc, p) => acc + (p.unrealizedCents ?? 0),
                0,
              );
              const totalCost = positions.reduce(
                (acc, p) => acc + p.costBasisCents,
                0,
              );
              const pct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
              const pos = totalPL > 0;
              const neg = totalPL < 0;
              return (
                <p
                  className={`mt-2 font-heading text-3xl font-black tabular-nums ${
                    pos ? "text-pigment-green" : neg ? "text-imperial-red" : "text-ink"
                  }`}
                >
                  {pos ? "▲ " : neg ? "▼ " : ""}
                  {fmtWb(totalPL, { signed: true })}{" "}
                  <span className="text-base font-medium text-ink/70">
                    ({pos ? "+" : ""}
                    {pct.toFixed(2)}%)
                  </span>
                </p>
              );
            })()}
          </div>
        )}

        {/* Recent orders */}
        <h2 className="mt-12 font-heading text-xl font-bold text-ink">Recent orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-ink/60">No orders yet.</p>
        ) : (
          <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
            {orders.map((o) => (
              <li
                key={o.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 text-sm"
              >
                <div>
                  <div className="font-bold">
                    {o.side === "buy" ? "Bought" : "Sold"} {fmtShares(o.shares)} {o.symbol}
                  </div>
                  <div className="text-xs text-ink/60">
                    @ {fmtUsd(o.priceCents)}/share · {new Date(o.createdAt).toLocaleString("en-US")}
                  </div>
                </div>
                <div
                  className={`font-heading font-black tabular-nums ${
                    o.side === "buy" ? "text-imperial-red" : "text-pigment-green"
                  }`}
                >
                  {o.side === "buy" ? "-" : "+"}
                  {fmtWb(o.totalCents)}
                </div>
              </li>
            ))}
          </ul>
        )}

        <Disclaimer />
      </main>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-white-smoke p-5">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink/60">{label}</p>
      <p className="mt-3 font-heading text-3xl font-black tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
