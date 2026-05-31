import { supabase } from "@/lib/supabase";

/**
 * Paid per-league access. A buy-in is recorded once per (user, group, season)
 * in `fantasy_entitlement` and auto-assigned to a concrete league within the
 * group by the `assign_league_entitlement` Postgres function (see the
 * fantasy_entitlements migration). Season is always the league's *configured*
 * season — never the live NFL state — so offseason drift can't orphan a row.
 */

export type Entitlement = {
  groupKey: string;
  season: string;
  /** Concrete league the buyer was seated in. null while `unassigned`. */
  assignedLeagueId: string | null;
  /** active | unassigned (group full) | refunded */
  status: string;
};

function shape(r: Record<string, unknown>): Entitlement {
  return {
    groupKey: String(r.group_key),
    season: String(r.season),
    assignedLeagueId: (r.assigned_league_id as string | null) ?? null,
    status: String(r.status),
  };
}

/** Every entitlement for a user, optionally scoped to one season. */
export async function getEntitlements(
  discordUserId: string,
  season?: string,
): Promise<Entitlement[]> {
  let q = supabase()
    .from("fantasy_entitlement")
    .select("group_key, season, assigned_league_id, status")
    .eq("discord_user_id", discordUserId);
  if (season) q = q.eq("season", season);
  const { data, error } = await q;
  if (error) throw new Error(`getEntitlements failed: ${error.message}`);
  return (data ?? []).map(shape);
}

/** True iff the user holds an active entitlement seating them in this league. */
export async function hasLeagueAccess(
  discordUserId: string,
  sleeperLeagueId: string,
  season: string,
): Promise<boolean> {
  const { data, error } = await supabase()
    .from("fantasy_entitlement")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .eq("assigned_league_id", sleeperLeagueId)
    .eq("season", season)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`hasLeagueAccess failed: ${error.message}`);
  return Boolean(data);
}

/**
 * Count of active entitlements per assigned league (for the admin fill view).
 * Returns a map keyed by `assigned_league_id`.
 */
export async function entitlementCountsByLeague(): Promise<Map<string, number>> {
  const { data, error } = await supabase()
    .from("fantasy_entitlement")
    .select("assigned_league_id")
    .eq("status", "active")
    .not("assigned_league_id", "is", null);
  if (error) throw new Error(`entitlementCountsByLeague failed: ${error.message}`);
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const id = r.assigned_league_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export type AssignInput = {
  discordUserId: string;
  discordUsername: string;
  groupKey: string;
  season: string;
  amountCents: number;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
};

/**
 * Idempotently record a paid buy-in and seat the buyer in a league within the
 * group. Safe to call from both the Stripe webhook and the success-page
 * finalizer — the DB function dedupes on `stripe_session_id`.
 */
export async function assignEntitlement(input: AssignInput): Promise<Entitlement | null> {
  const { data, error } = await supabase().rpc("assign_league_entitlement", {
    p_discord_user_id: input.discordUserId,
    p_discord_username: input.discordUsername,
    p_group_key: input.groupKey,
    p_season: input.season,
    p_amount_cents: input.amountCents,
    p_session_id: input.stripeSessionId,
    p_payment_intent_id: input.stripePaymentIntentId ?? null,
  });
  if (error) throw new Error(`assignEntitlement failed: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return row ? shape(row) : null;
}
