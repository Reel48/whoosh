import type { BalanceSeriesPoint } from "@/lib/wb/dashboard";

/**
 * Tiny inline-SVG sparkline of the user's WB cash balance over the last N days.
 * No charting library — just a polyline path scaled to a 600×120 viewBox.
 * The y-axis is anchored at 0 so the visual feels like "your balance,"
 * not "the slope of your balance."
 */
export function BalanceChart({ data }: { data: BalanceSeriesPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-ink/60">
        Not enough history yet — chart appears once you have a few days of activity.
      </p>
    );
  }

  const W = 600;
  const H = 120;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 20;

  const maxCents = Math.max(...data.map((p) => p.balanceCents), 100);
  const minCents = 0; // anchor at zero
  const yRange = Math.max(maxCents - minCents, 1);
  const xStep = data.length > 1 ? W / (data.length - 1) : W;

  function y(cents: number): number {
    const usable = H - PAD_TOP - PAD_BOTTOM;
    return PAD_TOP + usable - ((cents - minCents) / yRange) * usable;
  }

  const pathD = data
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * xStep).toFixed(1)},${y(p.balanceCents).toFixed(1)}`)
    .join(" ");

  // Closed area for fill under the line.
  const areaD = `${pathD} L${W},${H - PAD_BOTTOM} L0,${H - PAD_BOTTOM} Z`;

  const first = data[0];
  const last = data[data.length - 1];
  const delta = last.balanceCents - first.balanceCents;
  const positive = delta >= 0;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <path d={areaD} fill="currentColor" className="text-blue opacity-30" />
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-ink"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="font-bold uppercase tracking-wider text-ink/60">
          {formatDate(first.day)} → {formatDate(last.day)}
        </span>
        <span className="font-heading font-black tabular-nums text-ink">
          {positive ? "+" : ""}
          {formatMoney(delta)} over {data.length} days
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
