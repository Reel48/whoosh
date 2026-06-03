import { POPULAR_STOCKS, scoreSuggestion } from "@/lib/wb/stockList";
import { CRYPTO_ASSETS } from "@/lib/wb/assets";

/**
 * Symbol typeahead, shared by the form route (`/api/wb/search`) and the JSON API
 * (`/api/v1/wb/search`). Merges the crypto whitelist, the curated popular-stocks
 * list, and live Finnhub coverage; dedupes by symbol (crypto → curated → live)
 * and ranks by score. Returns [] on any Finnhub failure so the curated list
 * still works offline.
 */
export type SymbolSearchResult = { symbol: string; name: string; kind: "stock" | "crypto" };
type Scored = SymbolSearchResult & { score: number };

const FINNHUB_BASE = "https://finnhub.io/api/v1";

async function finnhubSearch(q: string): Promise<SymbolSearchResult[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];
  const url = `${FINNHUB_BASE}/search?q=${encodeURIComponent(q)}&token=${apiKey}`;
  try {
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      result?: { description?: string; displaySymbol?: string; symbol?: string; type?: string }[];
    };
    return (json.result ?? [])
      .filter((r) => {
        const sym = r.displaySymbol ?? r.symbol ?? "";
        // US common stocks only: skip OTC / foreign / derivatives and non-equity.
        return r.type === "Common Stock" && !!r.description && /^[A-Z]{1,5}$/.test(sym);
      })
      .map((r) => ({
        symbol: (r.displaySymbol ?? r.symbol)!.toUpperCase(),
        name: r.description!.replace(/\s+/g, " ").trim(),
        kind: "stock" as const,
      }));
  } catch {
    return [];
  }
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const needle = q.toUpperCase();

  const crypto: Scored[] = CRYPTO_ASSETS.filter(
    (c) => c.symbol.startsWith(needle) || c.name.toUpperCase().includes(needle),
  ).map((c) => ({
    symbol: c.symbol,
    name: c.name,
    kind: "crypto",
    score: scoreSuggestion(q, c.symbol, c.name),
  }));

  const curated: Scored[] = POPULAR_STOCKS.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    kind: "stock" as const,
    score: scoreSuggestion(q, s.symbol, s.name),
  })).filter((s) => s.score > 0);

  // Floor live results at a small score so Finnhub's relevance is respected
  // even when the simple scorer doesn't catch the match.
  const live: Scored[] = (await finnhubSearch(q)).map((r) => ({
    ...r,
    score: Math.max(scoreSuggestion(q, r.symbol, r.name), 12),
  }));

  const seen = new Set<string>();
  const merged: Scored[] = [];
  for (const r of [...crypto, ...curated, ...live]) {
    if (seen.has(r.symbol)) continue;
    seen.add(r.symbol);
    merged.push(r);
  }
  merged.sort((a, b) => b.score - a.score);

  return merged.slice(0, 8).map(({ symbol, name, kind }) => ({ symbol, name, kind }));
}
