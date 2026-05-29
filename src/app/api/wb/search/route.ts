import { NextResponse, type NextRequest } from "next/server";
import { POPULAR_STOCKS, scoreSuggestion } from "@/lib/wb/stockList";
import { CRYPTO_ASSETS } from "@/lib/wb/assets";

export const runtime = "edge";

type Result = { symbol: string; name: string; kind: "stock" | "crypto" };
type Scored = Result & { score: number };

const FINNHUB_BASE = "https://finnhub.io/api/v1";

/**
 * Live symbol search via Finnhub, so the typeahead covers the whole US market
 * (by ticker or company name) — not just the curated list. Filtered to US
 * common stocks, cached per query (symbols are stable) to stay well within the
 * free-tier rate limit. Returns [] on any failure so the curated list still
 * works offline / when Finnhub is down.
 */
async function finnhubSearch(q: string): Promise<Result[]> {
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
        // US common stocks only: skip OTC / foreign / derivatives (dots,
        // colons, empty descriptions) and non-equity types.
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

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });
  const needle = q.toUpperCase();

  // Crypto matches from the whitelist.
  const crypto: Scored[] = CRYPTO_ASSETS.filter(
    (c) => c.symbol.startsWith(needle) || c.name.toUpperCase().includes(needle),
  ).map((c) => ({
    symbol: c.symbol,
    name: c.name,
    kind: "crypto",
    score: scoreSuggestion(q, c.symbol, c.name),
  }));

  // Curated popular stocks (instant, hand-ranked).
  const curated: Scored[] = POPULAR_STOCKS.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    kind: "stock" as const,
    score: scoreSuggestion(q, s.symbol, s.name),
  })).filter((s) => s.score > 0);

  // Broad live coverage. Floor live results at a small score so Finnhub's own
  // relevance is respected even when our simple scorer doesn't catch the match.
  const live: Scored[] = (await finnhubSearch(q)).map((r) => ({
    ...r,
    score: Math.max(scoreSuggestion(q, r.symbol, r.name), 12),
  }));

  // Merge, dedupe by symbol (prefer crypto → curated → live), rank by score.
  const seen = new Set<string>();
  const merged: Scored[] = [];
  for (const r of [...crypto, ...curated, ...live]) {
    if (seen.has(r.symbol)) continue;
    seen.add(r.symbol);
    merged.push(r);
  }
  merged.sort((a, b) => b.score - a.score);

  const results: Result[] = merged.slice(0, 8).map(({ symbol, name, kind }) => ({ symbol, name, kind }));
  return NextResponse.json({ results });
}
