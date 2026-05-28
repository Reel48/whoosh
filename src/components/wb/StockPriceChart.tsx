import type { Candle } from "@/lib/wb/history";
import { WB_PER_USD } from "@/lib/wb/purchase";

type Props = {
  candles: Candle[];
  /** Optional reference line — typically the user's cost basis. */
  refLineCents?: number | null;
  refLineLabel?: string;
};

/**
 * Polished SSR-only SVG line chart of close prices over time.
 * - Y-axis: 5 ticks, drawn on the right.
 * - X-axis: start/middle/end date labels along the bottom.
 * - Line color: pigment-green if final ≥ first, imperial-red otherwise.
 * - Area fill under the line at low opacity.
 * - Optional reference horizontal line (cost basis, IPO price, etc.).
 *
 * No client JS — fine for a daily-resolution chart; hover tooltips can be
 * layered on later as a "use client" enhancement if/when we want them.
 */
export function StockPriceChart({ candles, refLineCents, refLineLabel }: Props) {
  if (candles.length < 2) {
    return (
      <p className="text-sm text-ink/60">
        Not enough price history to chart yet.
      </p>
    );
  }

  const W = 800;
  const H = 320;
  const PAD_LEFT = 8;
  const PAD_RIGHT = 64; // room for y-axis labels on the right
  const PAD_TOP = 16;
  const PAD_BOTTOM = 32;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const closes = candles.map((c) => c.closeCents);
  const includeRef = refLineCents != null && Number.isFinite(refLineCents);

  const lo = Math.min(...closes, includeRef ? refLineCents! : Infinity);
  const hi = Math.max(...closes, includeRef ? refLineCents! : -Infinity);
  // Add 5% padding above and below so the line doesn't kiss the edges.
  const pad = (hi - lo) * 0.05 || hi * 0.01 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const yRange = Math.max(yMax - yMin, 1);

  const xStep = plotW / (candles.length - 1);

  function x(i: number): number {
    return PAD_LEFT + i * xStep;
  }
  function y(cents: number): number {
    return PAD_TOP + plotH - ((cents - yMin) / yRange) * plotH;
  }

  const pathD = candles
    .map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.closeCents).toFixed(1)}`)
    .join(" ");

  const areaD = `${pathD} L${x(candles.length - 1).toFixed(1)},${PAD_TOP + plotH} L${PAD_LEFT},${PAD_TOP + plotH} Z`;

  const first = candles[0];
  const last = candles[candles.length - 1];
  const positive = last.closeCents >= first.closeCents;

  // Y-axis ticks — 5 evenly spaced between yMin and yMax, but labeled as
  // rounded dollar amounts for readability.
  const tickCount = 5;
  const ticks: { cents: number; yPx: number }[] = [];
  for (let i = 0; i < tickCount; i++) {
    const frac = i / (tickCount - 1);
    const cents = yMin + frac * yRange;
    ticks.push({ cents, yPx: y(cents) });
  }

  // X-axis date labels — first, middle, last.
  const dateLabels: { i: number; label: string }[] = [
    { i: 0, label: formatDate(first.time) },
    { i: Math.floor((candles.length - 1) / 2), label: formatDate(candles[Math.floor((candles.length - 1) / 2)].time) },
    { i: candles.length - 1, label: formatDate(last.time) },
  ];

  const lineColorClass = positive ? "text-pigment-green" : "text-imperial-red";

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Price chart from ${formatDate(first.time)} to ${formatDate(last.time)}`}
      >
        {/* Horizontal gridlines */}
        {ticks.map((t, i) => (
          <line
            key={`grid-${i}`}
            x1={PAD_LEFT}
            x2={W - PAD_RIGHT}
            y1={t.yPx}
            y2={t.yPx}
            stroke="currentColor"
            strokeWidth="1"
            className="text-ink/10"
          />
        ))}

        {/* Reference line (cost basis etc.) */}
        {includeRef && refLineCents! >= yMin && refLineCents! <= yMax && (
          <>
            <line
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={y(refLineCents!)}
              y2={y(refLineCents!)}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              className="text-ink/50"
            />
            {refLineLabel && (
              <text
                x={PAD_LEFT + 6}
                y={y(refLineCents!) - 6}
                fontSize="11"
                fontWeight="700"
                className="fill-ink/70"
              >
                {refLineLabel}
              </text>
            )}
          </>
        )}

        {/* Area fill */}
        <path d={areaD} fill="currentColor" className={`${lineColorClass} opacity-15`} />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={lineColorClass}
        />

        {/* End-point dot */}
        <circle
          cx={x(candles.length - 1)}
          cy={y(last.closeCents)}
          r="4"
          className={`${lineColorClass} fill-current`}
        />

        {/* Y-axis tick labels */}
        {ticks.map((t, i) => (
          <text
            key={`yt-${i}`}
            x={W - PAD_RIGHT + 8}
            y={t.yPx + 4}
            fontSize="11"
            fontWeight="600"
            className="fill-ink/60"
          >
            ${((t.cents * WB_PER_USD) / 100).toLocaleString("en-US", {
              minimumFractionDigits: t.cents * WB_PER_USD < 100_00 ? 2 : 0,
              maximumFractionDigits: 2,
            })}
          </text>
        ))}

        {/* X-axis date labels */}
        {dateLabels.map((d, i) => (
          <text
            key={`xd-${i}`}
            x={x(d.i)}
            y={H - 10}
            fontSize="11"
            fontWeight="600"
            textAnchor={i === 0 ? "start" : i === dateLabels.length - 1 ? "end" : "middle"}
            className="fill-ink/60"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function formatDate(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}
