/**
 * The Odds API (the-odds-api.com) client for the Whoosh Bucks sportsbook.
 *
 * Endpoints: /odds (lines for upcoming games), /scores (final results for
 * settlement), and /events (free list of upcoming games). Decimal odds map
 * straight to bet_outcome.odds_decimal.
 *
 * Credit budget (free tier = 500/mo). Billing is per sport per call, NOT per
 * game — one /odds call returns every game for the sport:
 *   - /odds   = `markets × regions` credits per sport (3 with us + 3 markets)
 *   - /scores = 2 credits per sport (1 without daysFrom, which we need)
 *   - /events = FREE (0 credits)
 * To avoid paying for sports with no games, fetchOddsForSport first does a free
 * /events pre-check and skips the paid /odds call when there's nothing to fetch.
 * Remaining credits are logged from the response headers.
 */

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const REGIONS = "us";
const SCORES_DAYS_FROM = "3";

export type OddsMarket = "h2h" | "spreads" | "totals";

export const MARKET_LABELS: Record<OddsMarket, string> = {
  h2h: "Moneyline",
  spreads: "Spread",
  totals: "Total",
};

export type NormalizedOutcome = {
  label: string;
  oddsDecimal: number;
  point: number | null;
  /** Stable match key: team name (h2h/spreads), "over"/"under" (totals), "Draw". */
  outcomeKey: string;
};

export type NormalizedEvent = {
  externalEventId: string;
  sportKey: string;
  sportTitle: string;
  market: OddsMarket;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string; // ISO
  outcomes: NormalizedOutcome[];
};

export type GameScore = {
  externalEventId: string;
  sportKey: string;
  completed: boolean;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
};

/** Raw shapes from the API (only the fields we read). */
type RawOutcome = { name: string; price: number; point?: number };
type RawMarket = { key: string; outcomes: RawOutcome[] };
type RawBookmaker = { key: string; title: string; markets: RawMarket[] };
type RawOddsEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: RawBookmaker[];
};
type RawEventListItem = { id: string; commence_time: string };
type RawScoreEntry = { name: string; score: string };
type RawScoreEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: RawScoreEntry[] | null;
};

// --- Config (env-driven so coverage scales without code changes) ---

const DEFAULT_SPORTS = [
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "basketball_nba",
  "baseball_mlb",
  "soccer_epl",
  "soccer_uefa_champs_league",
];

export function getEnabledSports(): string[] {
  const raw = process.env.ODDS_SPORTS?.trim();
  if (!raw) return DEFAULT_SPORTS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getEnabledMarkets(): OddsMarket[] {
  const raw = process.env.ODDS_MARKETS?.trim();
  const all: OddsMarket[] = ["h2h", "spreads", "totals"];
  if (!raw) return all;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is OddsMarket => (all as string[]).includes(s));
}

function apiKey(): string | null {
  const key = process.env.ODDS_API_KEY?.trim();
  if (!key) {
    console.warn("ODDS_API_KEY not set — odds fetch disabled.");
    return null;
  }
  return key;
}

function logCredits(res: Response, where: string): void {
  const remaining = res.headers.get("x-requests-remaining");
  const used = res.headers.get("x-requests-used");
  if (remaining !== null || used !== null) {
    console.log(
      JSON.stringify({ at: `odds.${where}`, credits_remaining: remaining, credits_used: used }),
    );
  }
}

function formatPoint(point: number): string {
  return point > 0 ? `+${point}` : `${point}`;
}

/** Pick the preferred bookmaker's market, falling back to the first that has it. */
function selectMarket(
  bookmakers: RawBookmaker[],
  market: OddsMarket,
  preferredKey: string | undefined,
): RawMarket | null {
  if (preferredKey) {
    const pref = bookmakers.find((b) => b.key === preferredKey);
    const m = pref?.markets.find((mk) => mk.key === market);
    if (m) return m;
  }
  for (const b of bookmakers) {
    const m = b.markets.find((mk) => mk.key === market);
    if (m) return m;
  }
  return null;
}

function normalizeOutcomes(market: OddsMarket, raw: RawMarket): NormalizedOutcome[] {
  const out: NormalizedOutcome[] = [];
  for (const o of raw.outcomes) {
    if (!Number.isFinite(o.price) || o.price <= 1) continue; // DB requires odds > 1
    if (market === "h2h") {
      out.push({ label: o.name, oddsDecimal: o.price, point: null, outcomeKey: o.name });
    } else if (market === "spreads") {
      if (o.point == null || !Number.isFinite(o.point)) continue;
      out.push({
        label: `${o.name} ${formatPoint(o.point)}`,
        oddsDecimal: o.price,
        point: o.point,
        outcomeKey: o.name,
      });
    } else {
      // totals: name is "Over"/"Under"
      if (o.point == null || !Number.isFinite(o.point)) continue;
      out.push({
        label: `${o.name} ${o.point}`,
        oddsDecimal: o.price,
        point: o.point,
        outcomeKey: o.name.toLowerCase(),
      });
    }
  }
  return out;
}

/**
 * Free (0-credit) pre-check: does this sport have any upcoming/in-play games?
 * Lets the caller skip the paid /odds call for empty or off-season sports.
 * Fails open (returns true) so a precheck error never silently drops a sport.
 */
export async function hasUpcomingGames(sportKey: string): Promise<boolean> {
  const key = apiKey();
  if (!key) return false;

  const url = new URL(`${ODDS_API_BASE}/sports/${sportKey}/events`);
  url.searchParams.set("apiKey", key);

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch (e) {
    console.error(`Events precheck failed for ${sportKey}:`, e);
    return true;
  }
  logCredits(res, "events");
  if (!res.ok) {
    console.error(`Events precheck ${sportKey}: ${res.status}`);
    return true;
  }
  const list = (await res.json().catch(() => null)) as RawEventListItem[] | null;
  return Array.isArray(list) && list.length > 0;
}

/**
 * Fetch upcoming games + lines for a sport, one NormalizedEvent per
 * (game × market). Returns [] on any failure (non-fatal for the sync loop).
 * Does a free /events pre-check first to avoid spending /odds credits on a
 * sport with no games.
 */
export async function fetchOddsForSport(sportKey: string): Promise<NormalizedEvent[]> {
  const key = apiKey();
  if (!key) return [];
  if (!(await hasUpcomingGames(sportKey))) {
    console.log(
      JSON.stringify({ at: "odds.skip", sport: sportKey, reason: "no upcoming games" }),
    );
    return [];
  }
  const markets = getEnabledMarkets();
  const preferredBook = process.env.ODDS_PRIMARY_BOOK?.trim() || undefined;

  const url = new URL(`${ODDS_API_BASE}/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", key);
  url.searchParams.set("regions", REGIONS);
  url.searchParams.set("markets", markets.join(","));
  url.searchParams.set("oddsFormat", "decimal");

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch (e) {
    console.error(`Odds fetch failed for ${sportKey}:`, e);
    return [];
  }
  logCredits(res, "odds");
  if (!res.ok) {
    console.error(`Odds fetch ${sportKey}: ${res.status} ${await res.text().catch(() => "")}`);
    return [];
  }

  const games = (await res.json().catch(() => null)) as RawOddsEvent[] | null;
  if (!Array.isArray(games)) return [];

  const events: NormalizedEvent[] = [];
  for (const g of games) {
    if (!g.id || !g.home_team || !g.away_team || !Array.isArray(g.bookmakers)) continue;
    for (const market of markets) {
      const raw = selectMarket(g.bookmakers, market, preferredBook);
      if (!raw) continue;
      const outcomes = normalizeOutcomes(market, raw);
      if (outcomes.length < 2) continue;
      events.push({
        externalEventId: g.id,
        sportKey: g.sport_key,
        sportTitle: g.sport_title,
        market,
        homeTeam: g.home_team,
        awayTeam: g.away_team,
        commenceTime: g.commence_time,
        outcomes,
      });
    }
  }
  return events;
}

/**
 * Fetch recent/completed game scores for a sport, keyed by externalEventId.
 * Returns [] on failure.
 */
export async function fetchScores(sportKey: string): Promise<GameScore[]> {
  const key = apiKey();
  if (!key) return [];

  const url = new URL(`${ODDS_API_BASE}/sports/${sportKey}/scores`);
  url.searchParams.set("apiKey", key);
  url.searchParams.set("daysFrom", SCORES_DAYS_FROM);

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch (e) {
    console.error(`Scores fetch failed for ${sportKey}:`, e);
    return [];
  }
  logCredits(res, "scores");
  if (!res.ok) {
    console.error(`Scores fetch ${sportKey}: ${res.status} ${await res.text().catch(() => "")}`);
    return [];
  }

  const games = (await res.json().catch(() => null)) as RawScoreEvent[] | null;
  if (!Array.isArray(games)) return [];

  const out: GameScore[] = [];
  for (const g of games) {
    const home = scoreFor(g.scores, g.home_team);
    const away = scoreFor(g.scores, g.away_team);
    out.push({
      externalEventId: g.id,
      sportKey: g.sport_key,
      completed: Boolean(g.completed),
      homeTeam: g.home_team,
      awayTeam: g.away_team,
      homeScore: home,
      awayScore: away,
    });
  }
  return out;
}

function scoreFor(scores: RawScoreEntry[] | null, team: string): number | null {
  if (!scores) return null;
  const entry = scores.find((s) => s.name === team);
  if (!entry) return null;
  const n = Number(entry.score);
  return Number.isFinite(n) ? n : null;
}
