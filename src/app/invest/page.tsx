import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ensureWallet, getBalance } from "@/lib/wb/ledger";
import { getPositions, getRecentOrders, type Position } from "@/lib/wb/invest";
import { getQuote } from "@/lib/wb/quotes";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invest — Whoosh" };

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function fmtShares(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

type PositionRow = Position & {
  marketPriceCents: number | null;
  marketValueCents: number | null;
  unrealizedCents: number | null;
};

async function enrichPositions(positions: Position[]): Promise<PositionRow[]> {
  const enriched = await Promise.all(
    positions.map(async (p): Promise<PositionRow> => {
      const q = await getQuote(p.symbol).catch(() => null);
      if (!q) {
        return { ...p, marketPriceCents: null, marketValueCents: null, unrealizedCents: null };
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
  return enriched;
}

export default async function InvestPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; error?: string; symbol?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord?next=/invest");
  await ensureWallet(session.id, session.username);

  const sp = await searchParams;
  const lookupSymbol = (sp.symbol ?? "").toUpperCase().trim();

  const [balance, positionsRaw, orders, lookupQuote] = await Promise.all([
    getBalance(session.id),
    getPositions(session.id),
    getRecentOrders(session.id, 10),
    lookupSymbol ? getQuote(lookupSymbol).catch(() => null) : Promise.resolve(null),
  ]);
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

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-24">
        <span className="text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink">
          Simulated investing
        </span>

        {/* Header tiles */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Tile label="Total equity" value={fmtMoney(totalEquity)} />
          <Tile label="Cash (WB)" value={fmtMoney(balance)} />
          <Tile label="Positions value" value={fmtMoney(portfolioValue)} />
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

        {/* Lookup + order */}
        <section className="mt-8 rounded-3xl border-2 border-ink bg-white-smoke p-6 text-ink sm:p-8">
          <h2 className="font-heading text-xl font-bold">Trade</h2>
          <p className="mt-2 text-sm font-medium text-ink/70">
            Prices are real US market quotes (delayed ~15 min via Yahoo).
            Orders fill at the most recent quote. Whoosh Bucks only — no real
            money involved.
          </p>

          {/* Symbol lookup */}
          <form action="/invest" method="GET" className="mt-4 flex flex-wrap gap-3">
            <input
              type="text"
              name="symbol"
              defaultValue={lookupSymbol}
              placeholder="Symbol (e.g. AAPL)"
              required
              autoComplete="off"
              className="flex-1 min-w-[180px] rounded-full border-2 border-ink bg-white-smoke px-4 py-3 font-heading font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-ink"
            />
            <button
              type="submit"
              className="cursor-pointer rounded-full border-2 border-ink bg-white-smoke px-5 py-3 text-sm font-bold transition-colors hover:bg-ink hover:text-white-smoke"
            >
              Look up
            </button>
          </form>

          {lookupSymbol && (
            <div className="mt-5 rounded-2xl border-2 border-ink bg-blue p-5">
              {lookupQuote ? (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-heading text-2xl font-black">{lookupQuote.symbol}</div>
                    <div className="font-heading text-2xl font-black tabular-nums">
                      {fmtMoney(lookupQuote.priceCents)}
                    </div>
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-ink/60">
                    quoted {new Date(lookupQuote.fetchedAt).toLocaleTimeString("en-US")}
                  </p>
                  <form action="/api/wb/invest/order" method="POST" className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_120px_auto]">
                    <input type="hidden" name="symbol" value={lookupQuote.symbol} />
                    <select
                      name="side"
                      className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-heading font-bold uppercase focus:outline-none focus:ring-2 focus:ring-ink"
                      defaultValue="buy"
                    >
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-heading font-bold text-ink/60">$</span>
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
                      className="cursor-pointer rounded-full border-2 border-ink bg-ink px-5 py-2 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
                    >
                      Place
                    </button>
                  </form>
                  <p className="mt-2 text-xs text-ink/60">
                    Enter a dollar amount <em>or</em> a share count — share count wins if both are given.
                  </p>
                </>
              ) : (
                <p className="font-medium text-ink/80">No quote found for {lookupSymbol}.</p>
              )}
            </div>
          )}
        </section>

        {/* Positions */}
        <h2 className="mt-12 font-heading text-xl font-bold text-ink">Positions</h2>
        {positions.length === 0 ? (
          <p className="mt-4 text-sm text-ink/60">No positions yet.</p>
        ) : (
          <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
            {positions.map((p) => (
              <li
                key={p.symbol}
                className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center gap-4 py-3 text-sm"
              >
                <div>
                  <div className="font-heading font-black">{p.symbol}</div>
                  <div className="text-xs text-ink/60">{fmtShares(p.shares)} shares</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-ink/60">Cost basis</div>
                  <div className="font-heading font-bold tabular-nums">{fmtMoney(p.costBasisCents)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-ink/60">Market</div>
                  <div className="font-heading font-bold tabular-nums">
                    {p.marketValueCents !== null ? fmtMoney(p.marketValueCents) : "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-ink/60">P/L</div>
                  <div
                    className={`font-heading font-black tabular-nums ${
                      p.unrealizedCents === null
                        ? "text-ink/60"
                        : p.unrealizedCents >= 0
                          ? "text-pigment-green"
                          : "text-imperial-red"
                    }`}
                  >
                    {p.unrealizedCents !== null
                      ? `${p.unrealizedCents >= 0 ? "+" : ""}${fmtMoney(p.unrealizedCents)}`
                      : "—"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
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
                    @ {fmtMoney(o.priceCents)} · {new Date(o.createdAt).toLocaleString("en-US")}
                  </div>
                </div>
                <div
                  className={`font-heading font-black tabular-nums ${
                    o.side === "buy" ? "text-imperial-red" : "text-pigment-green"
                  }`}
                >
                  {o.side === "buy" ? "-" : "+"}
                  {fmtMoney(o.totalCents)}
                </div>
              </li>
            ))}
          </ul>
        )}
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
