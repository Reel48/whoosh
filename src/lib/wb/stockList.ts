/**
 * Curated list of popular tickers for the symbol typeahead. Not exhaustive —
 * the lookup form still accepts any US-listed ticker. This list just powers
 * autocomplete suggestions for the most-likely queries.
 *
 * Format: [symbol, company name]. Keep alphabetical within each batch so
 * additions stay reviewable.
 */
export type StockSuggestion = { symbol: string; name: string };

export const POPULAR_STOCKS: StockSuggestion[] = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "ABNB", name: "Airbnb" },
  { symbol: "ADBE", name: "Adobe" },
  { symbol: "AMD", name: "AMD" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "AVGO", name: "Broadcom" },
  { symbol: "BA", name: "Boeing" },
  { symbol: "BAC", name: "Bank of America" },
  { symbol: "BRK.B", name: "Berkshire Hathaway" },
  { symbol: "C", name: "Citigroup" },
  { symbol: "COIN", name: "Coinbase" },
  { symbol: "COST", name: "Costco" },
  { symbol: "CRM", name: "Salesforce" },
  { symbol: "CVX", name: "Chevron" },
  { symbol: "DIS", name: "Disney" },
  { symbol: "DKNG", name: "DraftKings" },
  { symbol: "DPZ", name: "Domino's Pizza" },
  { symbol: "F", name: "Ford" },
  { symbol: "FDX", name: "FedEx" },
  { symbol: "GE", name: "GE" },
  { symbol: "GME", name: "GameStop" },
  { symbol: "GOOGL", name: "Alphabet (Google)" },
  { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "HD", name: "Home Depot" },
  { symbol: "HOOD", name: "Robinhood" },
  { symbol: "IBM", name: "IBM" },
  { symbol: "INTC", name: "Intel" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "JPM", name: "JPMorgan Chase" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "LCID", name: "Lucid Motors" },
  { symbol: "LMT", name: "Lockheed Martin" },
  { symbol: "LULU", name: "Lululemon" },
  { symbol: "MA", name: "Mastercard" },
  { symbol: "MARA", name: "Marathon Digital" },
  { symbol: "MCD", name: "McDonald's" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "MSTR", name: "MicroStrategy" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "NKE", name: "Nike" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "ORCL", name: "Oracle" },
  { symbol: "PEP", name: "PepsiCo" },
  { symbol: "PFE", name: "Pfizer" },
  { symbol: "PINS", name: "Pinterest" },
  { symbol: "PLTR", name: "Palantir" },
  { symbol: "PYPL", name: "PayPal" },
  { symbol: "QCOM", name: "Qualcomm" },
  { symbol: "RBLX", name: "Roblox" },
  { symbol: "RIVN", name: "Rivian" },
  { symbol: "ROKU", name: "Roku" },
  { symbol: "SBUX", name: "Starbucks" },
  { symbol: "SHOP", name: "Shopify" },
  { symbol: "SNAP", name: "Snap" },
  { symbol: "SOFI", name: "SoFi" },
  { symbol: "SPOT", name: "Spotify" },
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "SQ", name: "Block (Square)" },
  { symbol: "T", name: "AT&T" },
  { symbol: "TGT", name: "Target" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "TSM", name: "Taiwan Semi" },
  { symbol: "U", name: "Unity" },
  { symbol: "UBER", name: "Uber" },
  { symbol: "UNH", name: "UnitedHealth" },
  { symbol: "V", name: "Visa" },
  { symbol: "VZ", name: "Verizon" },
  { symbol: "WMT", name: "Walmart" },
  { symbol: "X", name: "United States Steel" },
  { symbol: "XOM", name: "ExxonMobil" },
];

/**
 * Default "Popular" suggestions shown when the search box is focused but empty.
 * Stocks only — crypto stays discoverable by typing, not surfaced by default.
 */
export const POPULAR_DEFAULT: StockSuggestion[] = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "GOOGL", name: "Alphabet (Google)" },
  { symbol: "SPY", name: "S&P 500 ETF" },
];

/**
 * Relevance score for a candidate against a query. Higher is better; 0 = no
 * match. Shared by the curated list, crypto, and live (Finnhub) results so
 * everything ranks consistently:
 *   exact symbol → symbol prefix → name prefix → name-word prefix →
 *   symbol contains → name contains.
 */
export function scoreSuggestion(q: string, symbol: string, name: string): number {
  const needle = q.trim().toUpperCase();
  if (!needle) return 0;
  const sym = symbol.toUpperCase();
  const nm = name.toUpperCase();
  if (sym === needle) return 100;
  if (sym.startsWith(needle)) return 90 - sym.length;
  if (nm.startsWith(needle)) return 70 - Math.min(nm.length, 40);
  if (nm.split(/[\s.&-]+/).some((w) => w.startsWith(needle))) return 60;
  if (sym.includes(needle)) return 40;
  if (nm.includes(needle)) return 30;
  return 0;
}

/**
 * Search the curated popular list. Returns at most `limit` results, ranked by
 * {@link scoreSuggestion}.
 */
export function searchStocks(q: string, limit = 8): StockSuggestion[] {
  if (!q.trim()) return [];
  const scored: (StockSuggestion & { score: number })[] = [];
  for (const s of POPULAR_STOCKS) {
    const score = scoreSuggestion(q, s.symbol, s.name);
    if (score > 0) scored.push({ ...s, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
