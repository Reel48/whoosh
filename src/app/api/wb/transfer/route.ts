import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ensureWallet } from "@/lib/wb/ledger";
import { findRecipient, transfer } from "@/lib/wb/transfer";
import { evaluateAchievements } from "@/lib/wb/achievements";
import { pushNotification } from "@/lib/wb/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(
      new URL("/api/auth/discord?next=/capital/wallet", req.url),
      303,
    );
  }
  // Ensure the sender's wallet exists so the balance check has something to read.
  await ensureWallet(session.id, session.username);

  let recipientUsername = "";
  let amountCents = 0;
  let memo: string | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as {
        recipient?: string;
        amount?: number;
        amount_cents?: number;
        memo?: string;
      };
      recipientUsername = String(body.recipient ?? "");
      amountCents =
        body.amount_cents ??
        (typeof body.amount === "number" ? Math.round(body.amount * 100) : 0);
      memo = body.memo ? String(body.memo).trim() : null;
    } else {
      const form = await req.formData();
      recipientUsername = String(form.get("recipient") ?? "");
      const raw = form.get("amount");
      amountCents =
        typeof raw === "string" && raw.trim() !== "" ? Math.round(Number(raw) * 100) : 0;
      const m = form.get("memo");
      memo = typeof m === "string" && m.trim() !== "" ? m.trim() : null;
    }
  } catch {
    return back(req, "Could not parse request.");
  }

  if (!recipientUsername.trim()) return back(req, "Recipient username is required.");
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return back(req, "Enter a positive amount.");
  }

  const recipient = await findRecipient(recipientUsername);
  if (!recipient) {
    return back(
      req,
      `No Whoosh wallet for @${recipientUsername.replace(/^@/, "")}. The recipient must sign in once before they can receive WB.`,
    );
  }

  const result = await transfer(session.id, recipient.discordUserId, amountCents, memo);
  if (!result.ok) return back(req, result.error);

  // Fire achievement check + notify recipient. Both are best-effort.
  await Promise.allSettled([
    evaluateAchievements(session.id),
    pushNotification({
      userId: recipient.discordUserId,
      kind: "transfer_in",
      title: `@${session.username} sent you $${(amountCents / 100).toFixed(2)} WB`,
      body: memo ?? undefined,
      href: "/capital/wallet",
    }),
  ]);

  return NextResponse.redirect(new URL(`/capital/wallet?transfer=ok`, req.url), 303);
}

function back(req: Request, msg: string) {
  return NextResponse.redirect(
    new URL(`/capital/wallet?error=${encodeURIComponent(msg)}`, req.url),
    303,
  );
}
