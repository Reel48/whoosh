import { supabase } from "@/lib/supabase";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const QUOTE_TTL_SECONDS = 60;

export type Quote = {
  symbol: string;
  priceCents: number;
  fetchedAt: string;
};

/**
 * Get a quote for a symbol. Reads from symbol_quote if fresh (within
 * QUOTE_TTL_SECONDS), otherwise fetches from Finnhub and writes through.
 *
 * Finnhub free tier: 60 req/min for US equities. Combined with the 60s
 * symbol_quote cache, that's effectively unlimited unique-symbol
 * throughput per minute for a Discord-scale community.
 */
export async function getQuote(symbolRaw: string): Promise<Quote | null> {
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) return null;

  const cached = await readCachedQuote(symbol);
  if (cached) return cached;

  const fresh = await fetchFreshQuote(symbol);
  if (!fresh) return null;

  await writeQuote(fresh);
  return fresh;
}

function normalizeSymbol(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
}

async function readCachedQuote(symbol: string): Promise<Quote | null> {
  const { data, error } = await supabase()
    .from("symbol_quote")
    .select("symbol, last_price_cents, fetched_at")
    .eq("symbol", symbol)
    .maybeSingle();
  if (error) throw new Error(`readCachedQuote failed: ${error.message}`);
  if (!data) return null;
  const ageMs = Date.now() - new Date(data.fetched_at).getTime();
  if (ageMs > QUOTE_TTL_SECONDS * 1000) return null;
  return {
    symbol: data.symbol,
    priceCents: Number(data.last_price_cents),
    fetchedAt: data.fetched_at,
  };
}

async function writeQuote(q: Quote): Promise<void> {
  const { error } = await supabase()
    .from("symbol_quote")
    .upsert(
      {
        symbol: q.symbol,
        last_price_cents: q.priceCents,
        fetched_at: q.fetchedAt,
      },
      { onConflict: "symbol" },
    );
  if (error) console.warn("writeQuote failed (non-fatal):", error.message);
}

async function fetchFreshQuote(symbol: string): Promise<Quote | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.warn("FINNHUB_API_KEY not set — quote fetch disabled.");
    return null;
  }
  const url = `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    console.error(`Finnhub quote fetch failed for ${symbol}:`, e);
    return null;
  }
  if (!res.ok) {
    console.error(`Finnhub quote ${symbol}: ${res.status}`);
    return null;
  }
  // Finnhub /quote returns { c: current, d, dp, h, l, o, pc: prev_close, t: timestamp }.
  // For invalid / unknown symbols all numeric fields come back as 0.
  const json = (await res.json()) as {
    c?: number;
    pc?: number;
    t?: number;
  };
  const price = json.c && json.c > 0 ? json.c : json.pc;
  if (!price || !Number.isFinite(price) || price <= 0) return null;
  return {
    symbol,
    priceCents: Math.round(price * 100),
    fetchedAt: new Date().toISOString(),
  };
}
