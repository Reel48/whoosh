import { unstable_cache } from "next/cache";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

export type CompanyProfile = {
  symbol: string;
  name: string;
  industry: string | null;
  country: string | null;
  currency: string;
  exchange: string | null;
  ipo: string | null;
  logoUrl: string | null;
  weburl: string | null;
  /** Market cap in dollars (Finnhub returns millions; we convert to dollars). */
  marketCap: number | null;
  /** Shares outstanding in millions. */
  shareOutstandingMillions: number | null;
};

/**
 * Fetch the company profile from Finnhub. Daily-stable data; cached for 1 day.
 * Returns null when the symbol is unknown or Finnhub is unreachable.
 */
async function fetchProfileFresh(symbol: string): Promise<CompanyProfile | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;
  const url = `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    console.error(`Finnhub profile fetch failed for ${symbol}:`, e);
    return null;
  }
  if (!res.ok) {
    console.error(`Finnhub profile ${symbol}: ${res.status}`);
    return null;
  }
  const json = (await res.json()) as {
    ticker?: string;
    name?: string;
    finnhubIndustry?: string;
    country?: string;
    currency?: string;
    exchange?: string;
    ipo?: string;
    logo?: string;
    weburl?: string;
    marketCapitalization?: number;  // in millions
    shareOutstanding?: number;       // in millions
  };
  if (!json.name) return null;
  return {
    symbol: json.ticker ?? symbol,
    name: json.name,
    industry: json.finnhubIndustry ?? null,
    country: json.country ?? null,
    currency: json.currency ?? "USD",
    exchange: json.exchange ?? null,
    ipo: json.ipo ?? null,
    logoUrl: json.logo || null,
    weburl: json.weburl || null,
    marketCap:
      json.marketCapitalization != null && Number.isFinite(json.marketCapitalization)
        ? json.marketCapitalization * 1_000_000
        : null,
    shareOutstandingMillions: json.shareOutstanding ?? null,
  };
}

const fetchProfileCached = unstable_cache(
  fetchProfileFresh,
  ["wb:company-profile"],
  { revalidate: 86_400 },
);

export async function getCompanyProfile(symbolRaw: string): Promise<CompanyProfile | null> {
  const symbol = symbolRaw.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
  if (!symbol) return null;
  return fetchProfileCached(symbol);
}
