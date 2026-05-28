import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getQuote } from "@/lib/wb/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sign-in-gated proxy so the Yahoo quote endpoint isn't exposed unauthenticated. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "";
  if (!symbol.trim()) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const q = await getQuote(symbol);
  if (!q) return NextResponse.json({ error: "quote unavailable" }, { status: 404 });
  return NextResponse.json(q);
}
