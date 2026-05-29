import type { SupplyPoint } from "@/lib/wb/admin";

/**
 * Simple inline SVG line chart of total WB supply over time. Server-rendered.
 * Y axis is implicit (range-fit), x axis is days with sparse labels.
 */
export function SupplyChart({ data }: { data: SupplyPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-ink/60">
        Not enough data yet — supply chart needs at least 2 days of activity.
      </p>
    );
  }

  const W = 800;
  const H = 200;
  const padL = 40;
  const padR = 8;
  const padT = 8;
  const padB = 24;

  const values = data.map((d) => d.supplyCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const x = (i: number) => padL + ((W - padL - padR) * i) / (data.length - 1);
  const y = (v: number) =>
    padT + (H - padT - padB) * (1 - (v - min) / range);

  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.supplyCents).toFixed(1)}`)
    .join(" ");

  const fillPath = `${path} L ${x(data.length - 1).toFixed(1)} ${(H - padB).toFixed(1)} L ${x(0).toFixed(1)} ${(H - padB).toFixed(1)} Z`;

  const xLabels = [0, Math.floor(data.length / 2), data.length - 1];
  const fmt = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label="Total WB supply over time"
    >
      <path d={fillPath} fill="rgba(72,203,255,0.15)" />
      <path d={path} stroke="#48cbff" strokeWidth="2" fill="none" />
      {/* y-axis ticks */}
      {[min, (min + max) / 2, max].map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(v)}
            y2={y(v)}
            stroke="rgba(0,0,0,0.08)"
            strokeDasharray="2 4"
          />
          <text
            x={padL - 4}
            y={y(v) + 4}
            textAnchor="end"
            fontSize="10"
            fill="rgba(0,0,0,0.6)"
          >
            {fmt(v)}
          </text>
        </g>
      ))}
      {/* x-axis labels */}
      {xLabels.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 6}
          textAnchor="middle"
          fontSize="10"
          fill="rgba(0,0,0,0.6)"
        >
          {fmtDate(data[i].day)}
        </text>
      ))}
    </svg>
  );
}
