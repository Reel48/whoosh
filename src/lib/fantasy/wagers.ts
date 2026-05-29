import { supabase } from "@/lib/supabase";
import { createEvent, getEvent, settleEvent, cancelEvent, type EventStatus } from "@/lib/wb/bets";
import { getWeekMatchups } from "./matchups";

/**
 * Whoosh Bucks tie-in for fantasy. Each weekly head-to-head matchup gets an
 * even-money (2.0×) wager event from the shared wager engine (src/lib/wb/bets.ts).
 * We record the mapping in `fantasy_matchup_event` so creation is idempotent
 * and so finished weeks can be settled by comparing Sleeper's final points to
 * the two outcomes. No new ledger logic — placeWager / settleEvent reuse the
 * existing bet_stake / bet_payout flow.
 */

export type MatchupWagerInfo = {
  eventId: number;
  status: EventStatus;
  homeRosterId: number;
  awayRosterId: number;
  homeOutcomeId: number;
  awayOutcomeId: number;
};

/**
 * Ensure an even-money wager event exists for every two-team matchup in the
 * given league/season/week. Returns the number of events created. Idempotent.
 */
export async function ensureMatchupEvents(
  sleeperLeagueId: string,
  season: string,
  week: number,
): Promise<number> {
  const matchups = await getWeekMatchups(sleeperLeagueId, week).catch(() => []);
  const playable = matchups.filter((m) => m.matchupId != null && m.away != null);
  if (playable.length === 0) return 0;

  const { data: existingRows, error } = await supabase()
    .from("fantasy_matchup_event")
    .select("matchup_id")
    .eq("sleeper_league_id", sleeperLeagueId)
    .eq("season", season)
    .eq("week", week);
  if (error) throw new Error(`ensureMatchupEvents read failed: ${error.message}`);
  const have = new Set((existingRows ?? []).map((r) => Number(r.matchup_id)));

  let created = 0;
  for (const m of playable) {
    const matchupId = m.matchupId!;
    const away = m.away!;
    if (have.has(matchupId)) continue;

    const eventId = await createEvent({
      title: `Week ${week} · ${m.home.teamName} vs ${away.teamName}`,
      description: "Fantasy matchup — even money. Winner is the higher final score.",
      closesAt: null,
      createdBy: null,
      outcomes: [
        { label: m.home.teamName, oddsDecimal: 2.0 },
        { label: away.teamName, oddsDecimal: 2.0 },
      ],
    });

    // createEvent inserts outcomes in order; getEvent returns them id-asc.
    const ev = await getEvent(eventId);
    const homeOutcomeId = ev?.outcomes[0]?.id;
    const awayOutcomeId = ev?.outcomes[1]?.id;
    if (!homeOutcomeId || !awayOutcomeId) continue;

    const { error: insErr } = await supabase().from("fantasy_matchup_event").insert({
      sleeper_league_id: sleeperLeagueId,
      season,
      week,
      matchup_id: matchupId,
      event_id: eventId,
      home_roster_id: m.home.rosterId,
      away_roster_id: away.rosterId,
      home_outcome_id: homeOutcomeId,
      away_outcome_id: awayOutcomeId,
    });
    // A concurrent run may have inserted first — the unique constraint guards us.
    if (insErr && !insErr.message.includes("duplicate")) {
      throw new Error(`ensureMatchupEvents insert failed: ${insErr.message}`);
    }
    if (!insErr) created += 1;
  }
  return created;
}

/**
 * Settle wager events for completed weeks (week < currentWeek). Compares final
 * Sleeper points: higher score wins (settleEvent), a tie refunds (cancelEvent).
 * Returns the number of matchup events settled.
 */
export async function settleFinishedWeeks(
  sleeperLeagueId: string,
  season: string,
  currentWeek: number,
): Promise<number> {
  const { data: rows, error } = await supabase()
    .from("fantasy_matchup_event")
    .select("id, week, matchup_id, event_id, home_outcome_id, away_outcome_id")
    .eq("sleeper_league_id", sleeperLeagueId)
    .eq("season", season)
    .eq("settled", false)
    .lt("week", currentWeek);
  if (error) throw new Error(`settleFinishedWeeks read failed: ${error.message}`);
  if (!rows || rows.length === 0) return 0;

  // Group by week so we fetch each week's matchups once.
  const byWeek = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byWeek.get(Number(r.week)) ?? [];
    list.push(r);
    byWeek.set(Number(r.week), list);
  }

  let settled = 0;
  for (const [week, weekRows] of byWeek) {
    const matchups = await getWeekMatchups(sleeperLeagueId, week).catch(() => []);
    const points = new Map<number, { home: number; away: number; hasAway: boolean }>();
    for (const m of matchups) {
      if (m.matchupId == null) continue;
      points.set(m.matchupId, {
        home: m.home.points,
        away: m.away?.points ?? 0,
        hasAway: m.away != null,
      });
    }

    for (const r of weekRows) {
      const p = points.get(Number(r.matchup_id));
      try {
        if (!p || !p.hasAway) {
          // No opponent / no data — refund any stakes.
          await cancelEvent(Number(r.event_id));
        } else if (p.home === p.away) {
          await cancelEvent(Number(r.event_id));
        } else {
          const winner = p.home > p.away ? Number(r.home_outcome_id) : Number(r.away_outcome_id);
          await settleEvent(Number(r.event_id), winner);
        }
        await supabase()
          .from("fantasy_matchup_event")
          .update({ settled: true })
          .eq("id", Number(r.id));
        settled += 1;
      } catch (e) {
        console.error(`settleFinishedWeeks: matchup_event ${r.id} failed:`, e);
      }
    }
  }
  return settled;
}

/**
 * Wager-event info keyed by matchup_id for a league/season/week — powers the
 * stake form on the Matchups page. Joins in the live bet_event status.
 */
export async function getMatchupWagerInfo(
  sleeperLeagueId: string,
  season: string,
  week: number,
): Promise<Map<number, MatchupWagerInfo>> {
  const { data: rows, error } = await supabase()
    .from("fantasy_matchup_event")
    .select("matchup_id, event_id, home_roster_id, away_roster_id, home_outcome_id, away_outcome_id")
    .eq("sleeper_league_id", sleeperLeagueId)
    .eq("season", season)
    .eq("week", week);
  if (error) throw new Error(`getMatchupWagerInfo failed: ${error.message}`);
  const out = new Map<number, MatchupWagerInfo>();
  if (!rows || rows.length === 0) return out;

  const eventIds = rows.map((r) => Number(r.event_id));
  const { data: events } = await supabase()
    .from("bet_event")
    .select("id, status")
    .in("id", eventIds);
  const statusById = new Map((events ?? []).map((e) => [Number(e.id), e.status as EventStatus]));

  for (const r of rows) {
    out.set(Number(r.matchup_id), {
      eventId: Number(r.event_id),
      status: statusById.get(Number(r.event_id)) ?? "open",
      homeRosterId: Number(r.home_roster_id),
      awayRosterId: Number(r.away_roster_id),
      homeOutcomeId: Number(r.home_outcome_id),
      awayOutcomeId: Number(r.away_outcome_id),
    });
  }
  return out;
}
