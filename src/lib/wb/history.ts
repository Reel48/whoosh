import { unstable_cache } from "next/cache";
import { getCryptoAsset } from "@/lib/wb/assets";

const TWELVEDATA_BASE = "https://api.twelvedata.com";

export type Candle = {
  /** Unix epoch seconds (market close timestamp). */
  time: number;
  /** Closing price in cents. */
  closeCents: number;
  /** Daily high in cents. */
  highCents: number;
  /** Daily low in cents. */
  lowCents: number;
};

export type StockSnapshot = {
  symbol: string;
  longName: string | null;
  exchange: string | null;
  currency: string;
  regularMarketPriceCents: number | null;
  regularMarketDayHighCents: number | null;
  regularMarketDayLowCents: number | null;
  fiftyTwoWeekHighCents: number | null;
  fiftyTwoWeekLowCents: number | null;
  regularMarketVolume: number | null;
  /** Daily close candles for the requested range. Oldest first. */
  candles: Candle[];
};

export type RangeKey = "1m" | "3m" | "6m" | "1y" | "5y";

export const RANGE_OPTIONS: { key: RangeKey; label: string; tradingDays: number }[] = [
  { key: "1m", label: "1M",  tradingDays: 22 },
  { key: "3m", label: "3M",  tradingDays: 66 },
  { key: "6m", label: "6M",  tradingDays: 132 },
  { key: "1y", label: "1Y",  tradingDays: 252 },
  { key: "5y", label: "5Y",  tradingDays: 1260 },
];

function tradingDaysFor(range: RangeKey): number {
  return RANGE_OPTIONS.find((r) => r.key === range)?.tradingDays ?? 252;
}

/** How many candles to pull from Twelve Data. We always grab at least a
 *  year so we can compute 52-week high/low from the same response, even
 *  when the user is viewing a 1M / 3M chart. */
function outputSizeFor(range: RangeKey): number {
  return Math.max(tradingDaysFor(range), 252) + 10; // pad for weekends/holidays
}

function toCents(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  const n = typeof s === "string" ? Number(s) : s;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

async function fetchSnapshotFresh(symbol: string, range: RangeKey): Promise<StockSnapshot | null> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    console.warn("TWELVEDATA_API_KEY not set — historical chart disabled.");
    return null;
  }
  const outputSize = outputSizeFor(range);
  // Crypto symbols on Twelve Data use the "BTC/USD" pair convention; stocks
  // are the bare ticker.
  const crypto = getCryptoAsset(symbol);
  const tdSymbol = crypto ? crypto.twelvedataSymbol : symbol;
  const url = `${TWELVEDATA_BASE}/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=1day&outputsize=${outputSize}&apikey=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    console.error(`Twelve Data fetch failed for ${symbol}:`, e);
    return null;
  }
  if (!res.ok) {
    console.error(`Twelve Data ${symbol}: ${res.status}`);
    return null;
  }
  const json = (await res.json()) as {
    status?: string;
    code?: number;
    message?: string;
    meta?: {
      symbol?: string;
      currency?: string;
      exchange?: string;
      type?: string;
    };
    values?: {
      datetime: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    }[];
  };

  if (json.status !== "ok" || !json.values || json.values.length === 0) {
    if (json.message) console.warn(`Twelve Data ${symbol}: ${json.message}`);
    return null;
  }

  // Twelve Data returns newest first; we want oldest first for charting.
  const sorted = [...json.values].reverse();
  const allCandles: Candle[] = sorted
    .map((v) => {
      const closeCents = toCents(v.close);
      const highCents = toCents(v.high);
      const lowCents = toCents(v.low);
      const time = Math.floor(new Date(v.datetime + "T20:00:00Z").getTime() / 1000);
      if (closeCents == null || highCents == null || lowCents == null) return null;
      return { time, closeCents, highCents, lowCents };
    })
    .filter((c): c is Candle => c !== null);

  // 52-week high/low: max/min over the trailing 252 candles (or all we have).
  const w52 = allCandles.slice(-252);
  const fiftyTwoWeekHighCents =
    w52.length > 0 ? Math.max(...w52.map((c) => c.highCents)) : null;
  const fiftyTwoWeekLowCents =
    w52.length > 0 ? Math.min(...w52.map((c) => c.lowCents)) : null;

  // Slice for chart display: only show what the user asked for.
  const displayCandles = allCandles.slice(-tradingDaysFor(range));

  const todays = allCandles[allCandles.length - 1];
  const regularMarketVolume = json.values[0]?.volume
    ? Math.round(Number(json.values[0].volume))
    : null;

  return {
    // Preserve the bare ticker the caller passed in (Twelve Data echoes
    // back "BTC/USD" for crypto; downstream code keys off "BTC").
    symbol,
    longName: null,                  // Twelve Data time_series doesn't include it; comes from CompanyProfile instead.
    exchange: json.meta?.exchange ?? null,
    currency: json.meta?.currency ?? "USD",
    regularMarketPriceCents: todays?.closeCents ?? null,
    regularMarketDayHighCents: todays?.highCents ?? null,
    regularMarketDayLowCents: todays?.lowCents ?? null,
    fiftyTwoWeekHighCents,
    fiftyTwoWeekLowCents,
    regularMarketVolume: regularMarketVolume && Number.isFinite(regularMarketVolume) ? regularMarketVolume : null,
    candles: displayCandles,
  };
}

/**
 * Cached for 1 hour per (symbol, range). EOD data only changes once daily
 * so this is generous; combined with Twelve Data's 800 req/day free tier
 * that's effectively unlimited at Discord-scale.
 */
const fetchSnapshotCached = unstable_cache(
  fetchSnapshotFresh,
  ["wb:stock-snapshot-td"],
  { revalidate: 3600 },
);

export async function getStockSnapshot(
  symbolRaw: string,
  range: RangeKey = "1y",
): Promise<StockSnapshot | null> {
  const symbol = symbolRaw.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
  if (!symbol) return null;
  return fetchSnapshotCached(symbol, range);
}
