import { supabase } from "@/lib/supabase";

export type ClaimResult = {
  claimed: boolean;
  amountCents: number;
  streak: number;
};

export async function claimDailyBonus(userId: string): Promise<ClaimResult> {
  const { data, error } = await supabase().rpc("fn_claim_daily_bonus", {
    p_user_id: userId,
  });
  if (error) throw new Error(`claimDailyBonus failed: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { claimed: boolean; amount_cents: number; streak: number }
    | null;
  if (!row) return { claimed: false, amountCents: 0, streak: 0 };
  return {
    claimed: row.claimed,
    amountCents: Number(row.amount_cents),
    streak: Number(row.streak),
  };
}

export async function getUserStreak(userId: string): Promise<number> {
  const { data, error } = await supabase().rpc("fn_user_streak", {
    p_user_id: userId,
  });
  if (error) throw new Error(`getUserStreak failed: ${error.message}`);
  return Number(data ?? 0);
}

/**
 * Whether the user has already claimed today's bonus. Cheap — single PK
 * lookup against user_daily_bonus.
 */
export async function hasClaimedToday(userId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase()
    .from("user_daily_bonus")
    .select("claim_date")
    .eq("discord_user_id", userId)
    .eq("claim_date", today)
    .maybeSingle();
  if (error) throw new Error(`hasClaimedToday failed: ${error.message}`);
  return !!data;
}
