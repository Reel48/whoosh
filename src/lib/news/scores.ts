/**
 * Live scores for the ticker. Reads ESPN's free public scoreboard API (no key)
 * per league, normalizes each game, and orders them live-first. Mirrors the
 * fetch-revalidate pattern used elsewhere; 30s revalidation keeps scores fresh
 * without hammering ESPN.
 */

type Team = { abbr: string; logo: string | null; score: string | null };
export type Game = {
  id: string;
  league: string;
  /** "pre" (upcoming) | "in" (live) | "post" (final) */
  state: "pre" | "in" | "post";
  /** ESPN's short status line, e.g. "Q3 5:21", "Final", "6/3 - 8:30 PM EDT". */
  detail: string;
  away: Team;
  home: Team;
  link: string | null;
  startsAt: string | null;
};

const LEAGUES: { label: string; path: string }[] = [
  { label: "NFL", path: "football/nfl" },
  { label: "NBA", path: "basketball/nba" },
  { label: "MLB", path: "baseball/mlb" },
  { label: "NHL", path: "hockey/nhl" },
  { label: "MLS", path: "soccer/usa.1" },
];

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  team?: { abbreviation?: string; logo?: string };
};
type EspnEvent = {
  id?: string;
  date?: string;
  status?: { type?: { state?: string; shortDetail?: string } };
  competitions?: { competitors?: EspnCompetitor[] }[];
  links?: { rel?: string[]; href?: string }[];
};

function team(c: EspnCompetitor | undefined): Team {
  return {
    abbr: c?.team?.abbreviation ?? "",
    logo: c?.team?.logo ?? null,
    score: c?.score ?? null,
  };
}

function mapEvent(league: string, e: EspnEvent): Game | null {
  const comp = e.competitions?.[0];
  const cs = comp?.competitors ?? [];
  if (cs.length < 2) return null; // skip non-team events (e.g. races)
  const home = cs.find((c) => c.homeAway === "home") ?? cs[0];
  const away = cs.find((c) => c.homeAway === "away") ?? cs[1];
  const st = e.status?.type ?? {};
  const state = st.state === "in" || st.state === "post" ? st.state : "pre";
  const link =
    e.links?.find((l) => l.href && (l.rel ?? []).includes("desktop"))?.href ??
    e.links?.[0]?.href ??
    null;
  return {
    id: String(e.id ?? `${league}-${away.team?.abbreviation}-${home.team?.abbreviation}`),
    league,
    state,
    detail: st.shortDetail ?? "",
    away: team(away),
    home: team(home),
    link,
    startsAt: e.date ?? null,
  };
}

async function fetchScoreboard(path: string): Promise<EspnEvent[]> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: EspnEvent[] };
    return data.events ?? [];
  } catch {
    return [];
  }
}

const STATE_ORDER = { in: 0, pre: 1, post: 2 } as const;

/** Today's games across the major team leagues, ordered live → upcoming → final. */
export async function getLiveScores(): Promise<Game[]> {
  const perLeague = await Promise.all(
    LEAGUES.map(async (l) => (await fetchScoreboard(l.path)).map((e) => mapEvent(l.label, e))),
  );
  const games = perLeague.flat().filter((g): g is Game => g !== null);
  games.sort((a, b) => {
    const s = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (s !== 0) return s;
    return (a.startsAt ?? "").localeCompare(b.startsAt ?? "");
  });
  return games.slice(0, 40);
}
