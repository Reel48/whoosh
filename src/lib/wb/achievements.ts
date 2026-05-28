import { supabase } from "@/lib/supabase";
import { pushNotification } from "@/lib/wb/notifications";

/**
 * Achievement catalog. Adding one: append to ACHIEVEMENTS and add an evaluator
 * call site (or wire into evaluateAfter*). The catalog is the source of truth
 * for icon + label — DB only stores the code string.
 */
export type AchievementCode =
  | "first_buy"
  | "first_trade"
  | "first_win"
  | "first_dividend"
  | "first_send"
  | "thirty_day_holder"
  | "big_win"
  | "diversified";

export type AchievementDef = {
  code: AchievementCode;
  label: string;
  description: string;
  icon: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "first_buy", label: "First Buck", description: "Bought your first Whoosh Bucks.", icon: "💸" },
  { code: "first_trade", label: "First Trade", description: "Placed your first invest order.", icon: "📈" },
  { code: "first_win", label: "First Win", description: "Won your first wager.", icon: "🏆" },
  { code: "first_dividend", label: "Coupon Clipper", description: "Received your first dividend.", icon: "💰" },
  { code: "first_send", label: "Generous", description: "Sent WB to another member.", icon: "🎁" },
  { code: "thirty_day_holder", label: "Diamond Hands", description: "Held a position 30+ days.", icon: "💎" },
  { code: "big_win", label: "Heater", description: "Single payout of $500 WB or more.", icon: "🔥" },
  { code: "diversified", label: "Portfolio Manager", description: "Held 5+ positions at once.", icon: "🧮" },
];

const BY_CODE = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));

export function getAchievementDef(code: string): AchievementDef | null {
  return BY_CODE.get(code as AchievementCode) ?? null;
}

export type EarnedAchievement = {
  code: AchievementCode;
  earnedAt: string;
};

export async function listEarned(userId: string): Promise<EarnedAchievement[]> {
  const { data, error } = await supabase()
    .from("user_achievement")
    .select("code, earned_at")
    .eq("discord_user_id", userId)
    .order("earned_at", { ascending: false });
  if (error) throw new Error(`listEarned failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    code: r.code as AchievementCode,
    earnedAt: r.earned_at,
  }));
}

/**
 * Grant an achievement if the user doesn't already have it. Returns true if
 * newly granted (so callers can fire a notification only once).
 */
export async function grantAchievement(
  userId: string,
  code: AchievementCode,
): Promise<boolean> {
  const def = BY_CODE.get(code);
  if (!def) return false;
  const { data, error } = await supabase()
    .from("user_achievement")
    .insert({ discord_user_id: userId, code })
    .select("code")
    .maybeSingle();
  // Duplicate key (23505) means already had it — not an error.
  if (error) {
    if (error.code === "23505") return false;
    throw new Error(`grantAchievement failed: ${error.message}`);
  }
  if (data) {
    await pushNotification({
      userId,
      kind: "achievement",
      title: `Achievement unlocked: ${def.label}`,
      body: def.description,
      href: "/account",
    }).catch(() => {
      /* notifications are best-effort */
    });
    return true;
  }
  return false;
}

/**
 * Cheap "did anything change?" evaluator — runs after any ledger-impacting
 * action. Grants whichever of the catalog this user has earned but not yet
 * received. Each rule is one query against the ledger or positions; called
 * in parallel.
 */
export async function evaluateAchievements(userId: string): Promise<void> {
  const ck = supabase();
  const earned = await listEarned(userId);
  const have = new Set(earned.map((e) => e.code));

  const checks: PromiseLike<unknown>[] = [];

  if (!have.has("first_buy")) {
    checks.push(
      ck
        .from("wb_ledger")
        .select("id", { head: true, count: "exact" })
        .eq("discord_user_id", userId)
        .eq("kind", "purchase")
        .limit(1)
        .then((r) => ((r.count ?? 0) > 0 ? grantAchievement(userId, "first_buy") : null)),
    );
  }
  if (!have.has("first_trade")) {
    checks.push(
      ck
        .from("invest_order")
        .select("id", { head: true, count: "exact" })
        .eq("discord_user_id", userId)
        .limit(1)
        .then((r) => ((r.count ?? 0) > 0 ? grantAchievement(userId, "first_trade") : null)),
    );
  }
  if (!have.has("first_win") || !have.has("big_win")) {
    checks.push(
      (async () => {
        const { data } = await ck
          .from("wb_ledger")
          .select("amount_cents")
          .eq("discord_user_id", userId)
          .eq("kind", "bet_payout")
          .gt("amount_cents", 0)
          .order("amount_cents", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          if (!have.has("first_win")) await grantAchievement(userId, "first_win");
          if (!have.has("big_win") && Number(data.amount_cents) >= 50000) {
            await grantAchievement(userId, "big_win");
          }
        }
      })(),
    );
  }
  if (!have.has("first_dividend")) {
    checks.push(
      ck
        .from("wb_ledger")
        .select("id", { head: true, count: "exact" })
        .eq("discord_user_id", userId)
        .eq("kind", "invest_dividend")
        .limit(1)
        .then((r) => ((r.count ?? 0) > 0 ? grantAchievement(userId, "first_dividend") : null)),
    );
  }
  if (!have.has("first_send")) {
    checks.push(
      ck
        .from("wb_ledger")
        .select("id", { head: true, count: "exact" })
        .eq("discord_user_id", userId)
        .eq("kind", "transfer_out")
        .limit(1)
        .then((r) => ((r.count ?? 0) > 0 ? grantAchievement(userId, "first_send") : null)),
    );
  }
  if (!have.has("diversified")) {
    checks.push(
      ck
        .from("invest_position")
        .select("symbol", { head: true, count: "exact" })
        .eq("discord_user_id", userId)
        .then((r) => ((r.count ?? 0) >= 5 ? grantAchievement(userId, "diversified") : null)),
    );
  }
  if (!have.has("thirty_day_holder")) {
    checks.push(
      ck
        .from("invest_position")
        .select("updated_at")
        .eq("discord_user_id", userId)
        .order("updated_at", { ascending: true })
        .limit(1)
        .maybeSingle()
        .then((r) => {
          if (!r.data) return null;
          const age = Date.now() - new Date(r.data.updated_at).getTime();
          if (age >= 30 * 24 * 60 * 60 * 1000) {
            return grantAchievement(userId, "thirty_day_holder");
          }
          return null;
        }),
    );
  }

  await Promise.allSettled(checks);
}
