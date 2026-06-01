import type { Candle } from "@/lib/wb/history";

type Props = {
  candles: Candle[];
  /** Optional reference line — typically the user's cost basis. */
  refLineCents?: number | null;
  refLineLabel?: string;
};

/**
 * SSR-only SVG line chart of close prices — Capital design system.
 * Gain/loss uses the design-system P&L series colors; gridlines and axis
 * labels use design-system chart tokens. Optional cost-basis reference line.
 */
export function StockPriceChart({ candles, refLineCents, refLineLabel }: Props) {
  if (candles.length < 2) {
    return <p className="text-body-sm">Not enough price history to chart yet.</p>;
  }

  const W = 800;
  const H = 320;
  const PAD_LEFT = 8;
  const PAD_RIGHT = 64;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 32;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const closes = candles.map((c) => c.closeCents);
  const includeRef = refLineCents != null && Number.isFinite(refLineCents);

  const lo = Math.min(...closes, includeRef ? refLineCents! : Infinity);
  const hi = Math.max(...closes, includeRef ? refLineCents! : -Infinity);
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

  const pathD = candles.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c.closeCents).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${x(candles.length - 1).toFixed(1)},${PAD_TOP + plotH} L${PAD_LEFT},${PAD_TOP + plotH} Z`;

  const first = candles[0];
  const last = candles[candles.length - 1];
  const positive = last.closeCents >= first.closeCents;
  const lineColor = positive ? "var(--chart-gain)" : "var(--chart-loss)";

  const tickCount = 5;
  const ticks: { cents: number; yPx: number }[] = [];
  for (let i = 0; i < tickCount; i++) {
    const frac = i / (tickCount - 1);
    const cents = yMin + frac * yRange;
    ticks.push({ cents, yPx: y(cents) });
  }

  const dateLabels: { i: number; label: string }[] = [
    { i: 0, label: formatDate(first.time) },
    { i: Math.floor((candles.length - 1) / 2), label: formatDate(candles[Math.floor((candles.length - 1) / 2)].time) },
    { i: candles.length - 1, label: formatDate(last.time) },
  ];

  const endX = x(candles.length - 1);
  const endY = y(last.closeCents);

  return (
    <div className="cap-mt" style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", width: "100%", height: "auto", color: lineColor }}
        role="img"
        aria-label={`Price chart from ${formatDate(first.time)} to ${formatDate(last.time)}`}
      >
        <defs>
          <linearGradient id="stockchart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <line key={`grid-${i}`} className="chart-grid" x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={t.yPx} y2={t.yPx} />
        ))}

        {includeRef && refLineCents! >= yMin && refLineCents! <= yMax && (
          <>
            <line
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={y(refLineCents!)}
              y2={y(refLineCents!)}
              stroke="var(--text-subtle)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            {refLineLabel && (
              <text x={PAD_LEFT + 6} y={y(refLineCents!) - 6} fontSize="11" fontWeight="700" fill="var(--text-muted)" fontFamily="var(--font-mono)">
                {refLineLabel}
              </text>
            )}
          </>
        )}

        <path d={areaD} fill="url(#stockchart-fill)" />
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* current-price marker with halo */}
        <circle cx={endX} cy={endY} r="9" fill="currentColor" opacity="0.16" />
        <circle cx={endX} cy={endY} r="4" fill="currentColor" stroke="var(--surface)" strokeWidth="2" />

        {ticks.map((t, i) => (
          <text key={`yt-${i}`} className="chart-axis-label" x={W - PAD_RIGHT + 8} y={t.yPx + 4}>
            ${(t.cents / 100).toLocaleString("en-US", { minimumFractionDigits: t.cents < 100_00 ? 2 : 0, maximumFractionDigits: 2 })}
          </text>
        ))}

        {dateLabels.map((d, i) => (
          <text
            key={`xd-${i}`}
            className="chart-axis-label"
            x={x(d.i)}
            y={H - 10}
            textAnchor={i === 0 ? "start" : i === dateLabels.length - 1 ? "end" : "middle"}
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "America/Chicago" });
}
