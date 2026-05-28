/**
 * Format Whoosh Bucks for display.
 *
 * Storage unit is "WB cents" (1 WB = 100 cents) — same convention as USD
 * cents but distinct currency. We render with a "WB" suffix (no dollar sign)
 * so users never confuse a balance with USD; the exchange rate (1 USD = 10 WB)
 * means a $-formatted WB amount would be misleading by an order of magnitude.
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
  return `${sign}${formatted} WB`;
}

/** Format real-USD market amounts (stock prices, Stripe charges). Keeps the
 *  dollar sign so the user can tell at a glance that this is "actual money,"
 *  not WB. */
export function formatUsd(cents: number, opts: { signed?: boolean } = {}): string {
  const sign = cents < 0 ? "-" : opts.signed && cents > 0 ? "+" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
