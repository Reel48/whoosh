/**
 * Thin read-only wrapper over ESPN's JSON news APIs. Mirrors the
 * fetch-revalidate pattern in src/lib/sleeper/client.ts (no auth, no key; Next's
 * per-fetch data cache serves repeat reads within the window).
 *
 * We use the JSON APIs rather than ESPN's public RSS because RSS truncates
 * headlines (its <title> is cut off with "…") and carries no images. Two JSON
 * endpoints cover every sport, both returning the same article shape:
 *  - site.api.espn.com/.../sports/<apiPath>/news  → { articles: [...] }
 *  - now.core.api.espn.com/v1/sports/news?sport=  → { headlines: [...] }   (boxing)
 */

export type SportKey =
  | "nfl"
  | "ncf"
  | "nba"
  | "mlb"
  | "soccer"
  | "nhl"
  | "golf"
  | "tennis"
  | "boxing"
  | "ncb"
  | "racing"
  | "mma";

export type Sport = {
  key: SportKey;
  /** Display label shown on the sport selector chips. */
  label: string;
  /** site.api.espn.com path: /sports/<apiPath>/news. */
  apiPath?: string;
  /** now.core.api.espn.com sport slug, for sports without a site-API news path. */
  nowSport?: string;
};

export const SPORTS: Record<SportKey, Sport> = {
  nfl: { key: "nfl", label: "NFL", apiPath: "football/nfl" },
  ncf: { key: "ncf", label: "College Football", apiPath: "football/college-football" },
  nba: { key: "nba", label: "NBA", apiPath: "basketball/nba" },
  mlb: { key: "mlb", label: "MLB", apiPath: "baseball/mlb" },
  soccer: { key: "soccer", label: "Soccer", apiPath: "soccer/all" },
  nhl: { key: "nhl", label: "NHL", apiPath: "hockey/nhl" },
  golf: { key: "golf", label: "Golf", apiPath: "golf/pga" },
  tennis: { key: "tennis", label: "Tennis", apiPath: "tennis/atp" },
  // No site-API news path — served by the "now" API instead.
  boxing: { key: "boxing", label: "Boxing", nowSport: "boxing" },
  ncb: { key: "ncb", label: "College Basketball", apiPath: "basketball/mens-college-basketball" },
  racing: { key: "racing", label: "Racing", nowSport: "racing" },
  mma: { key: "mma", label: "UFC/MMA", nowSport: "mma" },
};

export const SPORT_LIST: Sport[] = Object.values(SPORTS);

export const DEFAULT_SPORT: SportKey = "nfl";

/** Narrow an untrusted query value to a valid SportKey, defaulting to NFL. */
export function resolveSport(raw: string | undefined): SportKey {
  return raw && raw in SPORTS ? (raw as SportKey) : DEFAULT_SPORT;
}

export type Article = {
  /** Full, untruncated headline. */
  title: string;
  description: string;
  link: string;
  /** ISO date string from ESPN; formatted in the UI. */
  pubDate: string | null;
  author: string | null;
  guid: string;
  /** Image URLs for the post, shown at the bottom. Empty when none are provided. */
  images: string[];
};

/** Feed revalidation window (seconds). 10 min keeps headlines fresh enough. */
const FEED_TTL = 600;

type EspnImage = { url?: string };
type EspnArticle = {
  id?: number | string;
  headline?: string;
  description?: string;
  byline?: string;
  published?: string;
  images?: EspnImage[];
  links?: { web?: { href?: string } };
};

/** Map ESPN's JSON article shape (shared by both endpoints) to our Article. */
function fromJson(a: EspnArticle): Article {
  const link = a.links?.web?.href ?? "";
  const images = Array.isArray(a.images)
    ? [...new Set(a.images.map((im) => im?.url).filter((u): u is string => !!u && /^https?:/.test(u)))]
    : [];
  return {
    title: (a.headline ?? "").trim(),
    description: (a.description ?? "").trim(),
    link,
    pubDate: a.published ?? null,
    author: a.byline?.trim() || null,
    guid: String(a.id ?? link),
    images,
  };
}

/** Fetch + map a JSON news endpoint. `key` is the array field ESPN nests under. */
async function fetchJson(url: string, key: "articles" | "headlines"): Promise<Article[]> {
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: FEED_TTL } });
  } catch (e) {
    console.error(`ESPN news fetch failed (${url}):`, e);
    return [];
  }
  if (!res.ok) {
    console.error(`ESPN news ${res.status} (${url})`);
    return [];
  }
  try {
    const data = (await res.json()) as Record<string, EspnArticle[] | undefined>;
    return (data[key] ?? []).map(fromJson).filter((a) => a.title && a.link);
  } catch (e) {
    console.error(`ESPN news parse failed (${url}):`, e);
    return [];
  }
}

/**
 * Latest articles for a sport, with full headlines + images. Returns [] (and
 * logs) on any failure.
 */
export async function fetchFeed(sport: SportKey): Promise<Article[]> {
  const s = SPORTS[sport];
  if (s.apiPath) {
    return fetchJson(
      `https://site.api.espn.com/apis/site/v2/sports/${s.apiPath}/news?limit=50`,
      "articles",
    );
  }
  if (s.nowSport) {
    return fetchJson(
      `https://now.core.api.espn.com/v1/sports/news?sport=${s.nowSport}&limit=50`,
      "headlines",
    );
  }
  return [];
}
