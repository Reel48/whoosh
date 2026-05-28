import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createWbPurchaseCheckoutUrl } from "@/lib/wb/purchase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Initiate a Whoosh Bucks purchase.
 * Accepts either a form POST (preferred — the /wallet page submits a form) or JSON.
 * Redirects to the Stripe-hosted checkout URL on success.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL(`/api/auth/discord?next=/wallet`, req.url),
      303,
    );
  }

  let amountCents: number | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { amount_cents?: number; amount?: number };
      amountCents =
        body.amount_cents ??
        (typeof body.amount === "number" ? Math.round(body.amount * 100) : null);
    } else {
      const form = await req.formData();
      const raw = form.get("amount");
      if (typeof raw === "string" && raw.trim() !== "") {
        amountCents = Math.round(Number(raw) * 100);
      }
    }
  } catch {
    return badRequest("Could not parse request body.");
  }

  if (!amountCents || !Number.isFinite(amountCents) || amountCents <= 0) {
    return badRequest("Enter a positive USD amount.");
  }

  try {
    const url = await createWbPurchaseCheckoutUrl({
      amountCents,
      discordUserId: session.id,
      discordUsername: session.username,
    });
    return NextResponse.redirect(url, 303);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Checkout creation failed.";
    console.error("WB buy failed:", e);
    return NextResponse.redirect(
      new URL(`/wallet?error=${encodeURIComponent(msg)}`, req.url),
      303,
    );
  }
}

function badRequest(msg: string) {
  return new NextResponse(msg, { status: 400 });
}
