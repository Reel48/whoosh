import { supabase } from "@/lib/supabase";
import {
  fetchOddsForSport,
  getEnabledSports,
  type NormalizedEvent,
  type NormalizedOutcome,
} from "@/lib/wb/odds";

export type SyncResult = {
  sport: string;
  games: number;
  eventsCreated: number;
  eventsUpdated: number;
  outcomesUpserted: number;
};

/** Sync odds for every enabled sport. Non-fatal per sport. */
export async function runOddsSync(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const sport of getEnabledSports()) {
    try {
      results.push(await syncSport(sport));
    } catch (e) {
      console.error(`odds sync failed for ${sport}:`, e);
      results.push({ sport, games: 0, eventsCreated: 0, eventsUpdated: 0, outcomesUpserted: 0 });
    }
  }
  return results;
}

async function syncSport(sport: string): Promise<SyncResult> {
  const events = await fetchOddsForSport(sport);
  const result: SyncResult = {
    sport,
    games: new Set(events.map((e) => e.externalEventId)).size,
    eventsCreated: 0,
    eventsUpdated: 0,
    outcomesUpserted: 0,
  };
  if (events.length === 0) return result;

  // Existing odds_api events for this sport, keyed by externalEventId|market.
  const { data: existingRows, error } = await supabase()
    .from("bet_event")
    .select("id, external_event_id, market, status")
    .eq("source", "odds_api")
    .eq("sport_key", sport);
  if (error) throw new Error(`load existing events failed: ${error.message}`);
  const existing = new Map<string, { id: number; status: string }>();
  for (const r of existingRows ?? []) {
    existing.set(`${r.external_event_id}|${r.market}`, {
      id: Number(r.id),
      status: String(r.status),
    });
  }

  const nowMs = Date.now();
  for (const ev of events) {
    const key = `${ev.externalEventId}|${ev.market}`;
    const targetStatus = new Date(ev.commenceTime).getTime() <= nowMs ? "locked" : "open";
    const prior = existing.get(key);

    if (prior) {
      // Don't touch games that are already finished/voided.
      if (prior.status === "settled" || prior.status === "cancelled") continue;
      const { error: ue } = await supabase()
        .from("bet_event")
        .update({
          title: matchupTitle(ev),
          home_team: ev.homeTeam,
          away_team: ev.awayTeam,
          commence_time: ev.commenceTime,
          closes_at: ev.commenceTime,
          status: targetStatus,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", prior.id);
      if (ue) throw new Error(`update event failed: ${ue.message}`);
      result.eventsUpdated += 1;
      result.outcomesUpserted += await upsertOutcomes(prior.id, ev.outcomes);
    } else {
      const { data: ins, error: ie } = await supabase()
        .from("bet_event")
        .insert({
          title: matchupTitle(ev),
          description: null,
          status: targetStatus,
          created_by: null,
          closes_at: ev.commenceTime,
          source: "odds_api",
          external_event_id: ev.externalEventId,
          sport_key: ev.sportKey,
          market: ev.market,
          home_team: ev.homeTeam,
          away_team: ev.awayTeam,
          commence_time: ev.commenceTime,
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (ie) throw new Error(`insert event failed: ${ie.message}`);
      result.eventsCreated += 1;
      result.outcomesUpserted += await upsertOutcomes(Number(ins.id), ev.outcomes);
    }
  }
  return result;
}

function matchupTitle(ev: NormalizedEvent): string {
  return `${ev.awayTeam} @ ${ev.homeTeam}`;
}

/** Upsert outcomes by (event_id, outcome_key): update line/odds in place, keeping ids. */
async function upsertOutcomes(
  eventId: number,
  outcomes: NormalizedOutcome[],
): Promise<number> {
  const { data: existingRows, error } = await supabase()
    .from("bet_outcome")
    .select("id, outcome_key")
    .eq("event_id", eventId);
  if (error) throw new Error(`load outcomes failed: ${error.message}`);
  const byKey = new Map<string, number>();
  for (const r of existingRows ?? []) {
    if (r.outcome_key) byKey.set(String(r.outcome_key), Number(r.id));
  }

  let count = 0;
  const toInsert: Record<string, unknown>[] = [];
  for (const o of outcomes) {
    const id = byKey.get(o.outcomeKey);
    if (id) {
      const { error: ue } = await supabase()
        .from("bet_outcome")
        .update({ label: o.label, odds_decimal: o.oddsDecimal, point: o.point })
        .eq("id", id);
      if (ue) throw new Error(`update outcome failed: ${ue.message}`);
      count += 1;
    } else {
      toInsert.push({
        event_id: eventId,
        label: o.label,
        odds_decimal: o.oddsDecimal,
        point: o.point,
        outcome_key: o.outcomeKey,
      });
    }
  }
  if (toInsert.length > 0) {
    const { error: ie } = await supabase().from("bet_outcome").insert(toInsert);
    if (ie) throw new Error(`insert outcomes failed: ${ie.message}`);
    count += toInsert.length;
  }
  return count;
}
