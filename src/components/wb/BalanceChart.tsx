import type { BalanceSeriesPoint } from "@/lib/wb/dashboard";

/**
 * Area chart of the user's WB cash balance over the last N days — Capital
 * design system. Sky line with a soft gradient fill that fades to transparent,
 * rounded joins, a haloed end-point marker, and a faint baseline. y-axis
 * anchored at 0 so the shape reads as "your balance," not "the slope."
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
  const H = 170;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 14;
  const PAD_X = 8; // room so the end marker's halo isn't clipped

  const maxCents = Math.max(...data.map((p) => p.balanceCents), 100);
  const minCents = 0;
  const yRange = Math.max(maxCents - minCents, 1);
  const xStep = (W - PAD_X * 2) / (data.length - 1);
  const baselineY = H - PAD_BOTTOM;

  function y(cents: number): number {
    const usable = H - PAD_TOP - PAD_BOTTOM;
    return PAD_TOP + usable - ((cents - minCents) / yRange) * usable;
  }

  const pts = data.map((p, i) => ({ x: PAD_X + i * xStep, y: y(p.balanceCents) }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${W - PAD_X},${baselineY} L${PAD_X},${baselineY} Z`;

  const first = data[0];
  const last = data[data.length - 1];
  const delta = last.balanceCents - first.balanceCents;
  const positive = delta >= 0;
  const endPt = pts[pts.length - 1];

  return (
    <div className="cap-mt" style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", width: "100%", height: "auto", color: "var(--primary)" }}
        role="img"
        aria-label={`Cash balance over ${data.length} days`}
      >
        <defs>
          <linearGradient id="balchart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line x1="0" x2={W} y1={baselineY} y2={baselineY} stroke="var(--border)" strokeWidth="1" />

        {/* area + line */}
        <path d={areaD} fill="url(#balchart-fill)" />
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* end marker with halo */}
        <circle cx={endPt.x} cy={endPt.y} r="7" fill="currentColor" opacity="0.18" />
        <circle cx={endPt.x} cy={endPt.y} r="3.5" fill="currentColor" stroke="var(--surface)" strokeWidth="2" />
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
