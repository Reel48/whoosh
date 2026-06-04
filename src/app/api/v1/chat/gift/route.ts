import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wb/ledger";
import { transfer } from "@/lib/wb/transfer";
import { pushNotification } from "@/lib/wb/notifications";
import { sendChatMessage, getProfileByUsername, ChatError } from "@/lib/chat/chat";
import { jsonError, jsonOk, readJson, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { ChatGiftRequest, ChatGiftResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Send Whoosh Bucks to a chat @handle and post a gift card in the channel.
 * Resolves both parties by Whoosh handle (the wallet identity key is the auth
 * user id), reuses the `transfer()` engine (balance/self-send/cap/idempotency),
 * then authors the card as the sender — the `@recipient` in the body creates the
 * mention. Best-effort recipient push, mirroring /wb/transfer.
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;

  const body = await readJson<ChatGiftRequest>(req);
  if (!body) return jsonError("validation", "Request body must be valid JSON.");
  const channelId = Number(body.channelId);
  if (!channelId) return jsonError("validation", "channelId is required.");

  const amountCents =
    body.amountCents ?? (typeof body.amount === "number" ? Math.round(body.amount * 100) : 0);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return jsonError("validation", "Enter a positive amount.");
  }
  const memo = body.memo ? String(body.memo).trim() : null;

  const handle = String(body.recipient ?? "").replace(/^@/, "").trim();
  if (!handle) return jsonError("validation", "Recipient @handle is required.");
  const recipient = await getProfileByUsername(handle);
  if (!recipient) return jsonError("not_found", `No member found for @${handle}.`);
  if (recipient.id === session.id) return jsonError("validation", "You can't gift WB to yourself.");

  await ensureWallet(session.id, session.username);
  await ensureWallet(recipient.id, recipient.username);

  const result = await transfer(session.id, recipient.id, amountCents, memo);
  if (!result.ok) return jsonError("insufficient_funds", result.error);

  // Author the gift card as the sender; "@recipient" in the body parses to a mention.
  const dollars = `$${(amountCents / 100).toFixed(2)}`;
  try {
    const { message } = await sendChatMessage(session.id, channelId, {
      kind: "gift",
      body: `💸 Sent ${dollars} WB to @${recipient.username}${memo ? ` — ${memo}` : ""}`,
      data: {
        fromUsername: session.username,
        toUsername: recipient.username,
        amountCents,
        memo,
      },
    });
    // Best-effort recipient push (parity with /wb/transfer).
    await pushNotification({
      userId: recipient.id,
      kind: "transfer_in",
      title: `@${session.username} sent you ${dollars} WB`,
      body: memo ?? undefined,
      href: "/capital/wallet",
    }).catch(() => {});
    return jsonOk<ChatGiftResponse>({ message, transferId: result.transferId });
  } catch (e) {
    // The transfer already succeeded; surface a soft error so the client can refetch.
    if (e instanceof ChatError) return jsonError(e.code, e.message);
    return jsonError("internal", "Gift sent, but the card failed to post.");
  }
}
