import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ensureWallet } from "@/lib/wb/ledger";
import { addToWatchlist, removeFromWatchlist } from "@/lib/wb/watchlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL("/api/auth/discord?next=/capital/invest", req.url),
      303,
    );
  }
  await ensureWallet(session.id, session.username);

  let symbol = "";
  let action: "add" | "remove" = "add";
  try {
    const form = await req.formData();
    symbol = String(form.get("symbol") ?? "").toUpperCase().trim();
    const a = String(form.get("action") ?? "add");
    action = a === "remove" ? "remove" : "add";
  } catch {
    return back(req, "Could not parse request.", symbol);
  }
  if (!symbol) return back(req, "Symbol required.", symbol);

  try {
    if (action === "remove") {
      await removeFromWatchlist(session.id, symbol);
    } else {
      await addToWatchlist(session.id, symbol);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Watchlist failed.";
    return back(req, msg, symbol);
  }

  return NextResponse.redirect(
    new URL(`/capital/invest?symbol=${encodeURIComponent(symbol)}`, req.url),
    303,
  );
}

function back(req: Request, msg: string, symbol: string) {
  const sym = symbol ? `&symbol=${encodeURIComponent(symbol)}` : "";
  return NextResponse.redirect(
    new URL(`/capital/invest?error=${encodeURIComponent(msg)}${sym}`, req.url),
    303,
  );
}
