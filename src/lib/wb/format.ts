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
 * Format an amount that originates from real-USD market data (Twelve Data
 * candle close, Finnhub quote, Stripe invoice) for display in WB-dollars.
 * Multiplies by the WB-per-USD rate first so the displayed "$" amount
 * matches the WB cost the user actually transacts in.
 */
import { WB_PER_USD } from "@/lib/wb/purchase";

export function formatUsdAsWb(
  usdCents: number,
  opts: { signed?: boolean; decimals?: 0 | 2 } = {},
): string {
  return formatWb(usdCents * WB_PER_USD, opts);
}

/** Format real-USD market amounts in their native currency. Used when we
 *  want to show "what AAPL really trades at on the open market" alongside
 *  the WB price, not as a primary balance display. */
export function formatUsd(cents: number, opts: { signed?: boolean } = {}): string {
  const sign = cents < 0 ? "-" : opts.signed && cents > 0 ? "+" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
