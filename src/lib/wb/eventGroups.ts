import type { BetEvent, BetMarket } from "@/lib/wb/bets";

/** Display titles for synced sport keys. */
export const SPORT_TITLES: Record<string, string> = {
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "College Football",
  basketball_nba: "NBA",
  baseball_mlb: "MLB",
  soccer_epl: "Premier League",
  soccer_uefa_champs_league: "Champions League",
};

/** Order markets are shown within a game. */
export const MARKET_ORDER: BetMarket[] = ["h2h", "spreads", "totals"];

export function sportTitle(sportKey: string | null): string {
  if (!sportKey) return "Sports";
  return SPORT_TITLES[sportKey] ?? sportKey;
}

/**
 * A game = one matchup with its markets (moneyline / spread / totals) grouped
 * together. Synced events arrive as one `BetEvent` row per market; this folds
 * them into a single game. Manual events (no `externalEventId`) become their
 * own single-market game.
 */
export type Game = {
  key: string;
  sportKey: string | null;
  matchup: string;
  commenceTime: string | null;
  markets: BetEvent[];
};

/** Group events by game, markets ordered ML → spread → totals, games by time. */
export function groupSyncedByGame(events: BetEvent[]): Game[] {
  const byGame = new Map<string, Game>();
  for (const e of events) {
    const key = e.externalEventId ?? String(e.id);
    const g =
      byGame.get(key) ??
      ({
        key,
        sportKey: e.sportKey,
        matchup: e.title,
        commenceTime: e.commenceTime,
        markets: [],
      } satisfies Game);
    g.markets.push(e);
    byGame.set(key, g);
  }
  for (const g of byGame.values()) {
    g.markets.sort(
      (a, b) => MARKET_ORDER.indexOf(a.market ?? "h2h") - MARKET_ORDER.indexOf(b.market ?? "h2h"),
    );
  }
  return [...byGame.values()].sort((a, b) => {
    const ta = a.commenceTime ? new Date(a.commenceTime).getTime() : Infinity;
    const tb = b.commenceTime ? new Date(b.commenceTime).getTime() : Infinity;
    return ta - tb;
  });
}
