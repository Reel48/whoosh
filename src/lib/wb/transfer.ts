import { supabase } from "@/lib/supabase";

const MAX_TRANSFER_CENTS = 100_000_00; // $100k sanity cap per transfer

export type TransferResult =
  | { ok: true; transferId: number }
  | { ok: false; error: string };

/**
 * Look up a recipient wallet by Discord username (the lowercase handle, no @).
 * Case-insensitive. Returns null if no wallet exists yet (recipient must have
 * visited the site at least once so a wallet row was created).
 */
export async function findRecipient(
  username: string,
): Promise<{ discordUserId: string; discordUsername: string } | null> {
  const trimmed = username.replace(/^@/, "").trim();
  if (!trimmed) return null;
  const { data, error } = await supabase()
    .from("wallet")
    .select("discord_user_id, discord_username")
    .ilike("discord_username", trimmed)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findRecipient failed: ${error.message}`);
  if (!data) return null;
  return {
    discordUserId: data.discord_user_id,
    discordUsername: data.discord_username,
  };
}

/**
 * Send WB from `fromUserId` to `toUserId`. Atomic via fn_transfer:
 * either the sender debit, recipient credit, and wb_transfer row all
 * commit, or none of them do. Returns a structured error for known
 * failure modes (insufficient funds, self-send) so callers can render
 * a clean message.
 */
export async function transfer(
  fromUserId: string,
  toUserId: string,
  amountCents: number,
  memo: string | null,
): Promise<TransferResult> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Amount must be a positive number of cents." };
  }
  if (amountCents > MAX_TRANSFER_CENTS) {
    return { ok: false, error: `Maximum transfer is $${MAX_TRANSFER_CENTS / 100}.` };
  }
  if (fromUserId === toUserId) {
    return { ok: false, error: "You can't send WB to yourself." };
  }
  const { data, error } = await supabase().rpc("fn_transfer", {
    p_from: fromUserId,
    p_to: toUserId,
    p_amount_cents: amountCents,
    // p_memo is nullable `text` in Postgres; the generator types it non-null.
    p_memo: memo as string,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("insufficient funds")) {
      return { ok: false, error: "Insufficient funds." };
    }
    if (msg.includes("cannot transfer to yourself")) {
      return { ok: false, error: "You can't send WB to yourself." };
    }
    return { ok: false, error: `Transfer failed: ${msg}` };
  }
  return { ok: true, transferId: Number(data) };
}
