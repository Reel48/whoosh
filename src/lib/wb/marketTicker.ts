/**
 * Market quotes for the Capital ticker strip. Reads Finnhub's free /quote
 * endpoint per symbol, normalizes to a compact shape, and preserves watchlist
 * order. Mirrors the fetch-revalidate pattern in lib/news/scores.ts: each fetch
 * carries `next: { revalidate: 60 }`, so the Next data cache dedupes the call
 * across all concurrent viewers — roughly one request per symbol per minute
 * total (~18/min), well inside Finnhub's free 60 req/min tier no matter how many
 * members have Capital open.
 */
import { getCryptoAsset } from "@/lib/wb/assets";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const QUOTE_TTL_SECONDS = 60;

export type TickerQuote = {
  symbol: string;
  name: string;
  priceCents: number;
  changePct: number;
};

type WatchEntry = { symbol: string; name: string };

/**
 * Fixed watchlist, weighted toward indices/ETFs and mega-caps with BTC + ETH as
 * the only crypto. Index proxies are ETFs because Finnhub's free tier serves
 * bare ETF tickers, not `^GSPC`-style index symbols. Rendered in this order.
 */
const WATCHLIST: WatchEntry[] = [
  // Indices / ETFs
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "Nasdaq 100" },
  { symbol: "DIA", name: "Dow Jones" },
  { symbol: "IWM", name: "Russell 2000" },
  // Mega-caps
  { symbol: "AAPL", name: "Apple" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "META", name: "Meta" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AVGO", name: "Broadcom" },
  { symbol: "BRK.B", name: "Berkshire" },
  { symbol: "JPM", name: "JPMorgan" },
  { symbol: "V", name: "Visa" },
  { symbol: "WMT", name: "Walmart" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "XOM", name: "ExxonMobil" },
  // Crypto (BTC + ETH only)
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
];

type FinnhubQuote = { c?: number; dp?: number };

async function fetchOne(entry: WatchEntry, apiKey: string): Promise<TickerQuote | null> {
  // Crypto routes through BINANCE:<SYM>USDT; equities/ETFs are the bare ticker.
  const crypto = getCryptoAsset(entry.symbol);
  const finnhubSymbol = crypto ? crypto.finnhubSymbol : entry.symbol;
  const url = `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(finnhubSymbol)}&token=${apiKey}`;
  try {
    const res = await fetch(url, { next: { revalidate: QUOTE_TTL_SECONDS } });
    if (!res.ok) return null;
    const json = (await res.json()) as FinnhubQuote;
    const price = json.c;
    if (!price || !Number.isFinite(price) || price <= 0) return null;
    return {
      symbol: entry.symbol,
      name: entry.name,
      priceCents: Math.round(price * 100),
      changePct: Number.isFinite(json.dp ?? NaN) ? Number(json.dp) : 0,
    };
  } catch {
    return null;
  }
}

/** The watchlist with live quotes, in display order. Empty if the key is unset. */
export async function getMarketTicker(): Promise<TickerQuote[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.warn("FINNHUB_API_KEY not set — market ticker disabled.");
    return [];
  }
  const settled = await Promise.all(WATCHLIST.map((e) => fetchOne(e, apiKey)));
  return settled.filter((q): q is TickerQuote => q !== null);
}
