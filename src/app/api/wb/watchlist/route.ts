import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { addToWatchlist, removeFromWatchlist } from "@/lib/wb/watchlist";
import { redirectOk, requireSession, seeOther } from "@/lib/api/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEST = "/capital/invest";

/** Error redirect that preserves the symbol the user was viewing. */
function back(req: Request, msg: string, symbol: string) {
  const sym = symbol ? `&symbol=${encodeURIComponent(symbol)}` : "";
  return seeOther(req, `${DEST}?error=${encodeURIComponent(msg)}${sym}`);
}

export async function POST(req: Request) {
  const session = await requireSession(req, DEST);
  if (session instanceof NextResponse) return session;
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

  return redirectOk(req, DEST, `symbol=${encodeURIComponent(symbol)}`);
}
