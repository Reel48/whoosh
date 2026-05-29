import type { BalanceSeriesPoint } from "@/lib/wb/dashboard";

/**
 * Inline-SVG sparkline of the user's WB cash balance over the last N days.
 * Styled with the Capital design system: sky line + soft sky area fill, mono
 * caption with a signed delta. y-axis anchored at 0.
 */
export function BalanceChart({ data }: { data: BalanceSeriesPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="text-body-sm">
        Not enough history yet — the chart appears once you have a few days of activity.
      </p>
    );
  }

  const W = 600;
  const H = 120;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 20;

  const maxCents = Math.max(...data.map((p) => p.balanceCents), 100);
  const minCents = 0;
  const yRange = Math.max(maxCents - minCents, 1);
  const xStep = data.length > 1 ? W / (data.length - 1) : W;

  function y(cents: number): number {
    const usable = H - PAD_TOP - PAD_BOTTOM;
    return PAD_TOP + usable - ((cents - minCents) / yRange) * usable;
  }

  const pathD = data
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * xStep).toFixed(1)},${y(p.balanceCents).toFixed(1)}`)
    .join(" ");
  const areaD = `${pathD} L${W},${H - PAD_BOTTOM} L0,${H - PAD_BOTTOM} Z`;

  const first = data[0];
  const last = data[data.length - 1];
  const delta = last.balanceCents - first.balanceCents;
  const positive = delta >= 0;

  return (
    <div className="cap-mt" style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }} preserveAspectRatio="none" role="img" aria-label={`Cash balance over ${data.length} days`}>
        <path d={areaD} fill="var(--primary)" opacity="0.1" />
        <path
          className="series-1"
          d={pathD}
          fill="none"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="cap-card-head cap-mt-1">
        <span className="text-caption">
          {formatDate(first.day)} → {formatDate(last.day)}
        </span>
        <span className={`num ${positive ? "num--positive" : "num--negative"}`}>
          {positive ? "▲ +" : "▼ −"}
          {formatMoney(Math.abs(delta))} · {data.length}d
        </span>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
