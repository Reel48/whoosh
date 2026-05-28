import { supabase } from "@/lib/supabase";

export type EventStatus = "open" | "locked" | "settled" | "cancelled";
export type EventSource = "manual" | "odds_api";
export type BetMarket = "h2h" | "spreads" | "totals";

export type BetOutcome = {
  id: number;
  label: string;
  oddsDecimal: number;
  point: number | null;
  outcomeKey: string | null;
};

export type BetEvent = {
  id: number;
  title: string;
  description: string | null;
  status: EventStatus;
  createdBy: string | null;
  closesAt: string | null;
  settledOutcomeId: number | null;
  createdAt: string;
  source: EventSource;
  externalEventId: string | null;
  sportKey: string | null;
  market: BetMarket | null;
  homeTeam: string | null;
  awayTeam: string | null;
  commenceTime: string | null;
  outcomes: BetOutcome[];
};

export type WagerResult =
  | { ok: true; wagerId: number }
  | { ok: false; error: string };

async function loadOutcomes(eventIds: number[]): Promise<Map<number, BetOutcome[]>> {
  if (eventIds.length === 0) return new Map();
  const { data, error } = await supabase()
    .from("bet_outcome")
    .select("id, event_id, label, odds_decimal, point, outcome_key")
    .in("event_id", eventIds)
    .order("id", { ascending: true });
  if (error) throw new Error(`outcome query failed: ${error.message}`);
  const grouped = new Map<number, BetOutcome[]>();
  for (const r of data ?? []) {
    const list = grouped.get(Number(r.event_id)) ?? [];
    list.push({
      id: Number(r.id),
      label: r.label,
      oddsDecimal: Number(r.odds_decimal),
      point: r.point != null ? Number(r.point) : null,
      outcomeKey: (r.outcome_key as string | null) ?? null,
    });
    grouped.set(Number(r.event_id), list);
  }
  return grouped;
}

function shape(
  r: Record<string, unknown>,
  outcomes: BetOutcome[],
): BetEvent {
  return {
    id: Number(r.id),
    title: String(r.title),
    description: (r.description as string | null) ?? null,
    status: r.status as EventStatus,
    createdBy: (r.created_by as string | null) ?? null,
    closesAt: (r.closes_at as string | null) ?? null,
    settledOutcomeId: r.settled_outcome_id ? Number(r.settled_outcome_id) : null,
    createdAt: String(r.created_at),
    source: ((r.source as string | null) ?? "manual") as EventSource,
    externalEventId: (r.external_event_id as string | null) ?? null,
    sportKey: (r.sport_key as string | null) ?? null,
    market: (r.market as BetMarket | null) ?? null,
    homeTeam: (r.home_team as string | null) ?? null,
    awayTeam: (r.away_team as string | null) ?? null,
    commenceTime: (r.commence_time as string | null) ?? null,
    outcomes,
  };
}

export async function listOpenEvents(): Promise<BetEvent[]> {
  const { data, error } = await supabase()
    .from("bet_event")
    .select("*")
    .in("status", ["open", "locked"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`event query failed: ${error.message}`);
  const events = (data ?? []) as Record<string, unknown>[];
  const outcomes = await loadOutcomes(events.map((e) => Number(e.id)));
  return events.map((e) => shape(e, outcomes.get(Number(e.id)) ?? []));
}

export async function listRecentSettledEvents(limit = 5): Promise<BetEvent[]> {
  const { data, error } = await supabase()
    .from("bet_event")
    .select("*")
    .in("status", ["settled", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`event query failed: ${error.message}`);
  const events = (data ?? []) as Record<string, unknown>[];
  const outcomes = await loadOutcomes(events.map((e) => Number(e.id)));
  return events.map((e) => shape(e, outcomes.get(Number(e.id)) ?? []));
}

export async function listAllEvents(): Promise<BetEvent[]> {
  const { data, error } = await supabase()
    .from("bet_event")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`event query failed: ${error.message}`);
  const events = (data ?? []) as Record<string, unknown>[];
  const outcomes = await loadOutcomes(events.map((e) => Number(e.id)));
  return events.map((e) => shape(e, outcomes.get(Number(e.id)) ?? []));
}

export async function getEvent(eventId: number): Promise<BetEvent | null> {
  const { data, error } = await supabase()
    .from("bet_event")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(`event query failed: ${error.message}`);
  if (!data) return null;
  const outcomes = await loadOutcomes([eventId]);
  return shape(data as Record<string, unknown>, outcomes.get(eventId) ?? []);
}

export async function createEvent(input: {
  title: string;
  description: string | null;
  closesAt: string | null;
  createdBy: string;
  outcomes: { label: string; oddsDecimal: number }[];
}): Promise<number> {
  if (input.outcomes.length < 2) {
    throw new Error("event needs at least 2 outcomes");
  }
  const { data: ev, error: ee } = await supabase()
    .from("bet_event")
    .insert({
      title: input.title,
      description: input.description,
      status: "open",
      created_by: input.createdBy,
      closes_at: input.closesAt,
    })
    .select("id")
    .single();
  if (ee) throw new Error(`createEvent failed: ${ee.message}`);
  const eventId = Number(ev.id);

  const { error: oe } = await supabase()
    .from("bet_outcome")
    .insert(
      input.outcomes.map((o) => ({
        event_id: eventId,
        label: o.label,
        odds_decimal: o.oddsDecimal,
      })),
    );
  if (oe) throw new Error(`createEvent outcomes failed: ${oe.message}`);
  return eventId;
}

export async function setEventStatus(eventId: number, status: EventStatus): Promise<void> {
  const { error } = await supabase()
    .from("bet_event")
    .update({ status })
    .eq("id", eventId);
  if (error) throw new Error(`setEventStatus failed: ${error.message}`);
}

export async function placeWager(
  userId: string,
  eventId: number,
  outcomeId: number,
  stakeCents: number,
): Promise<WagerResult> {
  if (!Number.isInteger(stakeCents) || stakeCents <= 0) {
    return { ok: false, error: "Stake must be a positive amount." };
  }
  const { data, error } = await supabase().rpc("fn_place_wager", {
    p_user_id: userId,
    p_event_id: eventId,
    p_outcome_id: outcomeId,
    p_stake_cents: stakeCents,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("insufficient funds")) return { ok: false, error: "Insufficient funds." };
    if (msg.includes("is not open")) return { ok: false, error: "This event is closed." };
    return { ok: false, error: `Could not place wager: ${msg}` };
  }
  return { ok: true, wagerId: Number(data) };
}

export async function settleEvent(eventId: number, winningOutcomeId: number): Promise<number> {
  const { data, error } = await supabase().rpc("fn_settle_event", {
    p_event_id: eventId,
    p_winning_outcome_id: winningOutcomeId,
  });
  if (error) throw new Error(`settleEvent failed: ${error.message}`);
  return Number(data ?? 0);
}

export async function cancelEvent(eventId: number): Promise<number> {
  const { data, error } = await supabase().rpc("fn_cancel_event", { p_event_id: eventId });
  if (error) throw new Error(`cancelEvent failed: ${error.message}`);
  return Number(data ?? 0);
}

/**
 * Settle a sports event from its final score. Settles per-wager (h2h winner,
 * spread cover, total over/under) honoring each wager's frozen line, refunding
 * pushes. Returns the number of wagers settled.
 */
export async function settleEventByScore(
  eventId: number,
  homeScore: number,
  awayScore: number,
): Promise<number> {
  const { data, error } = await supabase().rpc("fn_settle_event_by_score", {
    p_event_id: eventId,
    p_home_score: homeScore,
    p_away_score: awayScore,
  });
  if (error) throw new Error(`settleEventByScore failed: ${error.message}`);
  return Number(data ?? 0);
}
