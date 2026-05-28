import { supabase } from "@/lib/supabase";
import { fetchScores, getEnabledSports, MARKET_LABELS, type OddsMarket } from "@/lib/wb/odds";
import { settleEventByScore } from "@/lib/wb/bets";
import { pushNotification } from "@/lib/wb/notifications";

export type SettleResult = {
  sport: string;
  completedGames: number;
  eventsSettled: number;
  wagersSettled: number;
};

/** Settle finished games for every enabled sport. Non-fatal per sport. */
export async function runOddsSettle(): Promise<SettleResult[]> {
  const results: SettleResult[] = [];
  for (const sport of getEnabledSports()) {
    try {
      results.push(await settleSport(sport));
    } catch (e) {
      console.error(`odds settle failed for ${sport}:`, e);
      results.push({ sport, completedGames: 0, eventsSettled: 0, wagersSettled: 0 });
    }
  }
  return results;
}

async function settleSport(sport: string): Promise<SettleResult> {
  const result: SettleResult = {
    sport,
    completedGames: 0,
    eventsSettled: 0,
    wagersSettled: 0,
  };

  // Credit-saver: skip the paid /scores call unless this sport has at least one
  // started, un-settled game that could actually be ready to settle.
  const { count, error: ce } = await supabase()
    .from("bet_event")
    .select("id", { count: "exact", head: true })
    .eq("source", "odds_api")
    .eq("sport_key", sport)
    .in("status", ["open", "locked"])
    .lte("commence_time", new Date().toISOString());
  if (ce) throw new Error(`settle precheck failed: ${ce.message}`);
  if (!count) return result;

  const scores = await fetchScores(sport);
  const completed = scores.filter(
    (s) => s.completed && s.homeScore != null && s.awayScore != null,
  );
  result.completedGames = completed.length;
  if (completed.length === 0) return result;

  const scoreByGame = new Map(completed.map((s) => [s.externalEventId, s]));

  const { data: rows, error } = await supabase()
    .from("bet_event")
    .select("id, external_event_id, market, title")
    .eq("source", "odds_api")
    .eq("sport_key", sport)
    .in("external_event_id", [...scoreByGame.keys()])
    .in("status", ["open", "locked"]);
  if (error) throw new Error(`load settleable events failed: ${error.message}`);

  for (const r of rows ?? []) {
    const score = scoreByGame.get(String(r.external_event_id));
    if (!score || score.homeScore == null || score.awayScore == null) continue;
    const n = await settleEventByScore(Number(r.id), score.homeScore, score.awayScore);
    if (n > 0) {
      result.eventsSettled += 1;
      result.wagersSettled += n;
      await notifyEventSettled(
        Number(r.id),
        String(r.title),
        r.market as OddsMarket | null,
      ).catch((e) => console.error("notify settle failed (non-fatal):", e));
    }
  }
  return result;
}

async function notifyEventSettled(
  eventId: number,
  matchup: string,
  market: OddsMarket | null,
): Promise<void> {
  const { data, error } = await supabase()
    .from("bet_wager")
    .select("discord_user_id, status")
    .eq("event_id", eventId)
    .in("status", ["won", "lost", "refunded"]);
  if (error) throw new Error(`load settled wagers failed: ${error.message}`);

  // Collapse to one notification per user for this event.
  const byUser = new Map<string, Set<string>>();
  for (const w of data ?? []) {
    const set = byUser.get(w.discord_user_id) ?? new Set<string>();
    set.add(String(w.status));
    byUser.set(w.discord_user_id, set);
  }

  const marketLabel = market ? MARKET_LABELS[market] : "Bet";
  for (const [userId, statuses] of byUser) {
    const result =
      statuses.size > 1
        ? "settled"
        : statuses.has("won")
          ? "won"
          : statuses.has("refunded")
            ? "pushed (refunded)"
            : "lost";
    await pushNotification({
      userId,
      kind: "bet_settled",
      title: "Bet settled",
      body: `${matchup} (${marketLabel}) — you ${result}.`,
      href: "/events",
      metadata: { event_id: eventId },
    });
  }
}
