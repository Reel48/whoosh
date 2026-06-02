import Link from "next/link";
import type { DashboardData } from "@/lib/wb/dashboard";
import { formatWb } from "@/lib/wb/format";

/**
 * Featured Capital widget for the /home dashboard. Surfaces the member's Total
 * Equity, lifetime return, a compact balance sparkline, and the cash / invested
 * / wagers split — the highest-value personal data on the page. The whole card
 * links into the Capital wallet.
 *
 * Self-contained on purpose: the richer Capital components (BalanceChart,
 * AllocationBar) depend on the capital-scoped stylesheet, which isn't loaded on
 * /home, so this composes a lightweight equivalent from the global tokens that
 * are available everywhere (--primary, --positive, --negative, --border…).
 *
 * `data` is null when the wallet lookup fails or the member has no wallet yet —
 * in that case we render a calm "set up your wallet" call to action instead.
 */
export function CapitalSnapshotCard({ data }: { data: DashboardData | null }) {
  if (!data) {
    return (
      <Link
        href="/capital/wallet"
        className="group flex flex-col gap-2 rounded-theme border-theme border-ink/10 bg-white p-7 shadow-theme transition-transform hover:-translate-y-1"
      >
        <span className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full border-2 border-ink bg-blue" />
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-ink/50">Capital</span>
        </span>
        <h3 className="font-display text-3xl font-black tracking-tight text-ink">Your wallet</h3>
        <p className="text-sm font-medium text-ink/70">
          Set up your wallet to track equity, invest, and place house wagers.
        </p>
        <span className="mt-2 inline-flex w-fit items-center gap-2 font-display text-sm font-bold text-blue">
          Open Capital
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      </Link>
    );
  }

  const { allocation, returns } = data;
  const equity = allocation.totalEquityCents;
  const retPct = returns.totalReturnFraction * 100;
  const retPositive = returns.totalReturnCents >= 0;
  const retColor = retPositive ? "var(--positive-text)" : "var(--negative-text)";
  const retSign = retPositive ? "+" : "";
  const allTime = `${retSign}${retPct.toFixed(1)}% all-time`;

  const day = data.dayChangeCents;
  const dayPositive = (day ?? 0) >= 0;
  const dayColor = dayPositive ? "var(--positive-text)" : "var(--negative-text)";
  const hasDelta = day != null || returns.totalReturnCents !== 0;

  return (
    <Link
      href="/capital/wallet"
      className="group flex flex-col gap-5 rounded-theme border-theme border-ink/10 bg-white p-7 shadow-theme transition-transform hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full border-2 border-ink bg-blue" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-ink/50">Capital</span>
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Total equity</p>
          <p className="font-display text-4xl font-black tracking-tight text-ink tabular-nums sm:text-5xl">
            {formatWb(equity)}
          </p>
          {hasDelta && (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm font-bold tabular-nums">
              {day != null ? (
                <>
                  <span style={{ color: dayColor }}>
                    {dayPositive ? "▲" : "▼"} {formatWb(day, { signed: true })} today
                  </span>
                  {returns.totalReturnCents !== 0 && (
                    <span className="font-semibold text-ink/45">· {allTime}</span>
                  )}
                </>
              ) : (
                <span style={{ color: retColor }}>
                  {retPositive ? "▲" : "▼"} {formatWb(returns.totalReturnCents, { signed: true })}
                  <span className="font-semibold text-ink/45"> · {allTime}</span>
                </span>
              )}
            </p>
          )}
        </div>
        <Sparkline series={data.balanceSeries} positive={retPositive} />
      </div>

      <AllocationRow
        cash={allocation.cashCents}
        invested={allocation.investedValueCents}
        wagers={allocation.openWagersCents}
      />

      <span className="inline-flex w-fit items-center gap-2 font-display text-sm font-bold text-blue">
        Open wallet
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}

/** Compact, self-contained balance sparkline. Renders nothing under 2 points. */
function Sparkline({
  series,
  positive,
}: {
  series: { balanceCents: number }[];
  positive: boolean;
}) {
  if (series.length < 2) return null;
  const W = 160;
  const H = 56;
  const PAD = 4;
  const max = Math.max(...series.map((p) => p.balanceCents), 1);
  const xStep = (W - PAD * 2) / (series.length - 1);
  const y = (c: number) => PAD + (H - PAD * 2) * (1 - c / max);
  const pts = series.map((p, i) => ({ x: PAD + i * xStep, y: y(p.balanceCents) }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${W - PAD},${H} L${PAD},${H} Z`;
  const stroke = positive ? "var(--positive)" : "var(--negative)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="hidden h-14 w-40 shrink-0 sm:block"
      style={{ color: stroke }}
      role="img"
      aria-label="Balance trend"
    >
      <defs>
        <linearGradient id="home-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#home-spark-fill)" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Cash / invested / wagers proportional bar + legend, on global tokens. */
function AllocationRow({
  cash,
  invested,
  wagers,
}: {
  cash: number;
  invested: number;
  wagers: number;
}) {
  const slices = [
    { label: "Cash", cents: Math.max(cash, 0), color: "var(--color-slate-300)" },
    { label: "Invested", cents: Math.max(invested, 0), color: "var(--primary)" },
    { label: "Wagers", cents: Math.max(wagers, 0), color: "var(--positive)" },
  ];
  const total = slices.reduce((a, s) => a + s.cents, 0);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-ink/5">
        {total > 0 &&
          slices.map((s) =>
            s.cents > 0 ? (
              <div key={s.label} style={{ width: `${(s.cents / total) * 100}%`, background: s.color }} />
            ) : null,
          )}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-xs font-semibold text-ink/60">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
            <span className="tabular-nums text-ink/80">{formatWb(s.cents, { decimals: 0 })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
