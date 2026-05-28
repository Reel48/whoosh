import { supabase } from "@/lib/supabase";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1

function makeCode(len = 7): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await supabase()
    .from("referral_code")
    .select("code")
    .eq("discord_user_id", userId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.code) return existing.data.code;

  // Try a few times in case of collision.
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    const { data, error } = await supabase()
      .from("referral_code")
      .insert({ discord_user_id: userId, code })
      .select("code")
      .maybeSingle();
    if (!error && data) return data.code;
    if (error && error.code !== "23505") {
      throw new Error(`referral code create failed: ${error.message}`);
    }
  }
  throw new Error("could not allocate referral code");
}

export async function resolveCode(code: string): Promise<string | null> {
  if (!code) return null;
  const { data, error } = await supabase()
    .from("referral_code")
    .select("discord_user_id")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.discord_user_id ?? null;
}

/**
 * Record that `referredUserId` used `code` — but only if they haven't
 * already been referred. Idempotent.
 */
export async function recordReferralUse(
  referredUserId: string,
  code: string,
): Promise<{ created: boolean; referrerId: string | null }> {
  const referrerId = await resolveCode(code);
  if (!referrerId || referrerId === referredUserId) {
    return { created: false, referrerId: null };
  }
  const { error } = await supabase()
    .from("referral_use")
    .insert({
      referrer_user_id: referrerId,
      referred_user_id: referredUserId,
      code: code.toUpperCase(),
    });
  if (error) {
    if (error.code === "23505") return { created: false, referrerId };
    throw new Error(`recordReferralUse failed: ${error.message}`);
  }
  return { created: true, referrerId };
}

export type ReferralStats = {
  code: string;
  totalReferred: number;
  totalRewarded: number;
  totalRewardCents: number;
};

/**
 * Look up the referrer for a referred user. Returns null if there's no
 * referral_use row, or if the reward has already been issued.
 */
export async function pendingReferralFor(
  referredUserId: string,
): Promise<{ referrerId: string; code: string } | null> {
  const { data, error } = await supabase()
    .from("referral_use")
    .select("referrer_user_id, code, rewarded")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.rewarded) return null;
  return { referrerId: data.referrer_user_id, code: data.code };
}

export async function markReferralRewarded(
  referredUserId: string,
  rewardCents: number,
): Promise<void> {
  const { error } = await supabase()
    .from("referral_use")
    .update({
      rewarded: true,
      rewarded_at: new Date().toISOString(),
      reward_amount_cents: rewardCents,
    })
    .eq("referred_user_id", referredUserId);
  if (error) throw new Error(error.message);
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await getOrCreateReferralCode(userId);
  const { data, error } = await supabase()
    .from("referral_use")
    .select("rewarded, reward_amount_cents")
    .eq("referrer_user_id", userId);
  if (error) throw new Error(error.message);
  const totalReferred = data?.length ?? 0;
  const rewarded = (data ?? []).filter((r) => r.rewarded);
  const totalRewarded = rewarded.length;
  const totalRewardCents = rewarded.reduce(
    (acc, r) => acc + Number(r.reward_amount_cents ?? 0),
    0,
  );
  return { code, totalReferred, totalRewarded, totalRewardCents };
}
