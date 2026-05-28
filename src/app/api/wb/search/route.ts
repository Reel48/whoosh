import { NextResponse, type NextRequest } from "next/server";
import { searchStocks } from "@/lib/wb/stockList";
import { CRYPTO_ASSETS } from "@/lib/wb/assets";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  const needle = q.toUpperCase();
  const cryptos = CRYPTO_ASSETS.filter(
    (c) =>
      c.symbol.startsWith(needle) ||
      c.name.toUpperCase().includes(needle),
  ).map((c) => ({ symbol: c.symbol, name: c.name, kind: "crypto" as const }));

  const stocks = searchStocks(q, 8).map((s) => ({
    symbol: s.symbol,
    name: s.name,
    kind: "stock" as const,
  }));

  return NextResponse.json({ results: [...cryptos, ...stocks].slice(0, 10) });
}
