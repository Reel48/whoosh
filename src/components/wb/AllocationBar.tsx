type Slice = {
  label: string;
  cents: number;
  /** Tailwind background-color utility for the bar segment + legend dot. */
  className: string;
  /** Short subtitle below the dollar amount. */
  hint?: string;
};

/**
 * Horizontal proportional bar showing how a wallet's equity is split across
 * cash / invested / locked-in-wagers. Zero-total case renders a flat
 * placeholder bar so the layout doesn't collapse.
 */
export function AllocationBar({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((acc, s) => acc + Math.max(s.cents, 0), 0);

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full border-theme border-ink bg-surface">
        {total === 0 ? (
          <div className="h-full w-full bg-surface" />
        ) : (
          slices.map((s, i) => {
            const pct = (Math.max(s.cents, 0) / total) * 100;
            if (pct < 0.01) return null;
            return (
              <div
                key={i}
                className={`h-full ${s.className}`}
                style={{ width: `${pct}%` }}
                title={`${s.label}: ${formatMoney(s.cents)}`}
              />
            );
          })
        )}
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {slices.map((s, i) => {
          const pct = total === 0 ? 0 : (Math.max(s.cents, 0) / total) * 100;
          return (
            <li key={i} className="flex items-start gap-2">
              <span
                className={`mt-1 inline-block h-3 w-3 flex-none rounded-full border-theme border-ink ${s.className}`}
              />
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider text-ink/60">
                  {s.label} · {pct.toFixed(0)}%
                </div>
                <div className="font-display text-lg font-black tabular-nums">
                  {formatMoney(s.cents)}
                </div>
                {s.hint && <div className="text-xs text-ink/60">{s.hint}</div>}
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
