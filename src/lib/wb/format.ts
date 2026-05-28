/**
 * Format Whoosh Bucks for display. WB is the unit of account for the
 * simulation, branded as "fictional dollars" — so it renders with a "$"
 * prefix and no suffix. Internally stored in WB cents (1 WB = 100 cents),
 * same convention as USD cents.
 *
 * Real-USD market data (stock prices, Stripe USD amounts) is mapped into
 * WB-display units at the call site by multiplying by WB_PER_USD before
 * passing in here — so a "$X" amount always represents WB to the viewer,
 * even when it originated from a USD price feed.
 *
 * `signed: true` prefixes positive amounts with "+" so the sign reads as
 * a delta (e.g. on lifetime stats tiles, ledger rows).
 */
export function formatWb(
  cents: number,
  opts: { signed?: boolean; decimals?: 0 | 2 } = {},
): string {
  const { signed = false, decimals = 2 } = opts;
  const sign = cents < 0 ? "-" : signed && cents > 0 ? "+" : "";
  const abs = Math.abs(cents) / 100;
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}$${formatted}`;
}

/**
 * Format a real-USD amount (stock prices, Stripe charges) for display.
 * 1 WB = $1, so WB and USD render the same way — but keeping a named
 * helper makes the code's currency intent legible at the call site.
 */
export function formatUsd(cents: number, opts: { signed?: boolean } = {}): string {
  const sign = cents < 0 ? "-" : opts.signed && cents > 0 ? "+" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
