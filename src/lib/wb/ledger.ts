import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

export type LedgerKind =
  | "purchase"
  | "premium_match"
  | "fantasy_match"
  | "interest"
  | "transfer_in"
  | "transfer_out"
  | "bet_stake"
  | "bet_payout"
  | "invest_buy"
  | "invest_sell"
  | "invest_dividend"
  | "daily_bonus"
  | "referral_reward"
  | "adjustment";

export type CreditLedgerInput = {
  discordUserId: string;
  discordUsername: string;
  amountCents: number;
  kind: LedgerKind;
  /** External event source — e.g. "stripe_event", "transfer", "wager". */
  refKind?: string;
  /** External event id — must be unique within (refKind, refId). */
  refId?: string;
  memo?: string;
  metadata?: Json;
};

export type LedgerEntry = {
  id: number;
  amountCents: number;
  kind: LedgerKind;
  memo: string | null;
  createdAt: string;
};

/** Ensure a wallet row exists for the user. Idempotent. */
export async function ensureWallet(
  discordUserId: string,
  discordUsername: string,
): Promise<void> {
  const { error } = await supabase().rpc("ensure_wallet", {
    p_user_id: discordUserId,
    p_username: discordUsername,
  });
  if (error) throw new Error(`ensureWallet failed: ${error.message}`);
}

/**
 * Insert a ledger row. If (refKind, refId) is provided and a row already
 * exists for that pair, returns null (idempotent no-op).
 */
export async function creditLedger(input: CreditLedgerInput): Promise<number | null> {
  await ensureWallet(input.discordUserId, input.discordUsername);
  const { data, error } = await supabase().rpc("fn_credit_ledger", {
    p_user_id: input.discordUserId,
    p_amount_cents: input.amountCents,
    p_kind: input.kind,
    // The Postgres params are nullable `text`, but Supabase's type generator
    // emits them as non-null `string`; cast the intentional nulls through.
    p_ref_kind: (input.refKind ?? null) as string,
    p_ref_id: (input.refId ?? null) as string,
    p_memo: (input.memo ?? null) as string,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`creditLedger failed: ${error.message}`);
  return data ?? null;
}

/** Returns the user's current balance in cents (0 if no wallet exists yet). */
export async function getBalance(discordUserId: string): Promise<number> {
  const { data, error } = await supabase()
    .from("wallet_balance")
    .select("balance_cents")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();
  if (error) throw new Error(`getBalance failed: ${error.message}`);
  return Number(data?.balance_cents ?? 0);
}

/** Recent ledger entries for a user, newest first. */
export async function getRecentLedger(
  discordUserId: string,
  limit = 25,
): Promise<LedgerEntry[]> {
  const { data, error } = await supabase()
    .from("wb_ledger")
    .select("id, amount_cents, kind, memo, created_at")
    .eq("discord_user_id", discordUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentLedger failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    amountCents: Number(r.amount_cents),
    kind: r.kind as LedgerKind,
    memo: r.memo,
    createdAt: r.created_at,
  }));
}

export type LedgerFilter = {
  kinds?: LedgerKind[];
  since?: string; // ISO date
  until?: string; // ISO date
  limit?: number;
};

export async function queryLedger(
  discordUserId: string,
  filter: LedgerFilter = {},
): Promise<LedgerEntry[]> {
  let q = supabase()
    .from("wb_ledger")
    .select("id, amount_cents, kind, memo, created_at")
    .eq("discord_user_id", discordUserId)
    .order("created_at", { ascending: false });
  if (filter.kinds && filter.kinds.length > 0) {
    q = q.in("kind", filter.kinds);
  }
  if (filter.since) {
    q = q.gte("created_at", filter.since);
  }
  if (filter.until) {
    q = q.lte("created_at", filter.until);
  }
  q = q.limit(Math.min(filter.limit ?? 500, 2000));
  const { data, error } = await q;
  if (error) throw new Error(`queryLedger failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    amountCents: Number(r.amount_cents),
    kind: r.kind as LedgerKind,
    memo: r.memo,
    createdAt: r.created_at,
  }));
}
