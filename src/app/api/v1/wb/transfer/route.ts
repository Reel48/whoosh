import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { findRecipient, transfer } from "@/lib/wb/transfer";
import { evaluateAchievements } from "@/lib/wb/achievements";
import { pushNotification } from "@/lib/wb/notifications";
import { jsonError, readJson, requireBearerSession, respondResult } from "@/lib/api/json";
import type { TransferRequest, TransferResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** JSON re-shell of `POST /api/wb/transfer`. Reuses `findRecipient` + `transfer`. */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  await ensureWallet(session.id, session.username);

  const body = await readJson<TransferRequest>(req);
  if (!body) return jsonError("validation", "Request body must be valid JSON.");

  const recipientUsername = String(body.recipient ?? "");
  const amountCents =
    body.amountCents ??
    (typeof body.amount === "number" ? Math.round(body.amount * 100) : 0);
  const memo = body.memo ? String(body.memo).trim() : null;

  if (!recipientUsername.trim()) return jsonError("validation", "Recipient username is required.");
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return jsonError("validation", "Enter a positive amount.");
  }

  const recipient = await findRecipient(recipientUsername);
  if (!recipient) {
    return jsonError(
      "not_found",
      `No Whoosh wallet for @${recipientUsername.replace(/^@/, "")}. The recipient must sign in once before they can receive WB.`,
    );
  }

  const result = await transfer(session.id, recipient.discordUserId, amountCents, memo);
  if (result.ok) {
    // Best-effort, exactly as the form route: achievement check + notify recipient.
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
  }
  return respondResult<{ transferId: number }, TransferResponse>(result, (r) => ({
    transferId: r.transferId,
  }));
}
