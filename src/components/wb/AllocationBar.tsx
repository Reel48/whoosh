type Tone = "positive" | "primary" | "negative" | "neutral";

type Slice = {
  label: string;
  cents: number;
  /** Design-system color role for the bar segment + legend swatch. */
  tone: Tone;
  /** Short subtitle below the dollar amount. */
  hint?: string;
};

const TONE_VAR: Record<Tone, string> = {
  positive: "var(--positive)",
  primary: "var(--primary)",
  negative: "var(--negative)",
  neutral: "var(--color-slate-300)",
};

/**
 * Horizontal proportional bar showing how a wallet's equity is split across
 * cash / invested / locked-in-wagers. Styled with the Capital design system.
 * Zero-total renders a flat placeholder so the layout doesn't collapse.
 */
export function AllocationBar({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((acc, s) => acc + Math.max(s.cents, 0), 0);

  return (
    <div>
      <div className="cap-alloc__track">
        {total > 0 &&
          slices.map((s, i) => {
            const pct = (Math.max(s.cents, 0) / total) * 100;
            if (pct < 0.01) return null;
            return (
              <div
                key={i}
                style={{ width: `${pct}%`, background: TONE_VAR[s.tone] }}
                title={`${s.label}: ${formatMoney(s.cents)}`}
              />
            );
          })}
      </div>

      <ul className="cap-alloc__legend">
        {slices.map((s, i) => {
          const pct = total === 0 ? 0 : (Math.max(s.cents, 0) / total) * 100;
          return (
            <li key={i} className="cap-alloc__item">
              <span className="cap-alloc__swatch" style={{ background: TONE_VAR[s.tone] }} />
              <div className="min-w-0">
                <div className="kpi__label">
                  {s.label} · {pct.toFixed(0)}%
                </div>
                <div className="cap-alloc__val">{formatMoney(s.cents)}</div>
                {s.hint && <div className="text-caption">{s.hint}</div>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
