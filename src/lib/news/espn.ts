/**
 * Thin read-only wrapper over ESPN's per-sport RSS feeds. Mirrors the
 * fetch-revalidate pattern in src/lib/sleeper/client.ts: no auth, no key, and
 * Next's per-fetch data cache (revalidate) serves repeat reads of the same
 * sport within the window. ESPN's feed is RSS 2.0 with a flat <item> list whose
 * fields are CDATA-wrapped — stable and shallow enough to parse without an XML
 * dependency (see parseFeed).
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
  | "ncb";

export type Sport = {
  key: SportKey;
  /** Display label shown on the sport selector chips. */
  label: string;
  /** ESPN feed slug — https://www.espn.com/espn/rss/<code>/news */
  code: string;
};

export const SPORTS: Record<SportKey, Sport> = {
  nfl: { key: "nfl", label: "NFL", code: "nfl" },
  ncf: { key: "ncf", label: "College Football", code: "ncf" },
  nba: { key: "nba", label: "NBA", code: "nba" },
  mlb: { key: "mlb", label: "MLB", code: "mlb" },
  soccer: { key: "soccer", label: "Soccer", code: "soccer" },
  nhl: { key: "nhl", label: "NHL", code: "nhl" },
  golf: { key: "golf", label: "Golf", code: "golf" },
  tennis: { key: "tennis", label: "Tennis", code: "tennis" },
  boxing: { key: "boxing", label: "Boxing", code: "boxing" },
  ncb: { key: "ncb", label: "College Basketball", code: "ncb" },
};

export const SPORT_LIST: Sport[] = Object.values(SPORTS);

export const DEFAULT_SPORT: SportKey = "nfl";

/** Narrow an untrusted query value to a valid SportKey, defaulting to NFL. */
export function resolveSport(raw: string | undefined): SportKey {
  return raw && raw in SPORTS ? (raw as SportKey) : DEFAULT_SPORT;
}

export type Article = {
  title: string;
  description: string;
  link: string;
  /** Raw RSS date string (e.g. "Mon, 1 Jun 2026 07:37:51 EST"); format in the UI. */
  pubDate: string | null;
  author: string | null;
  guid: string;
  /**
   * Image URLs found on the item, shown at the bottom of the post. ESPN's news
   * feeds don't currently carry per-item images, so this is usually empty — but
   * we extract enclosure/media/embedded <img> so they appear if a feed adds them.
   */
  images: string[];
};

/** Feed revalidation window (seconds). ESPN's own ttl is 30; 10 min is plenty. */
const FEED_TTL = 600;

function feedUrl(code: string): string {
  return `https://www.espn.com/espn/rss/${code}/news`;
}

/** Unwrap a CDATA section if present, then decode the common XML entities. */
function clean(raw: string | undefined): string {
  if (!raw) return "";
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  const text = cdata ? cdata[1] : raw;
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Inner content of the first <name ...>…</name> in `block` (namespace-safe). */
function tag(block: string, name: string): string | undefined {
  const safe = name.replace(/:/g, "\\:");
  const m = block.match(new RegExp(`<${safe}[^>]*>([\\s\\S]*?)</${safe}>`, "i"));
  return m?.[1];
}

/** Collect image URLs from an item: enclosure, media:*, and embedded <img>. */
function extractImages(block: string): string[] {
  const urls = new Set<string>();
  // <enclosure url="…" type="image/…"> and <media:content|media:thumbnail url="…">
  for (const m of block.matchAll(
    /<(?:enclosure|media:content|media:thumbnail)\b[^>]*\burl="([^"]+)"[^>]*>/gi,
  )) {
    if (/image/i.test(m[0]) || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(m[1])) urls.add(m[1]);
  }
  // <img src="…"> embedded in description / content:encoded (CDATA HTML).
  for (const m of block.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)) urls.add(m[1]);
  return [...urls];
}

/** Parse an ESPN RSS document into articles. Tolerant of missing optional tags. */
export function parseFeed(xml: string): Article[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((block): Article => {
      const link = clean(tag(block, "link"));
      return {
        title: clean(tag(block, "title")),
        description: clean(tag(block, "description")),
        link,
        pubDate: clean(tag(block, "pubDate")) || null,
        author: clean(tag(block, "dc:creator")) || null,
        guid: clean(tag(block, "guid")) || link,
        images: extractImages(block),
      };
    })
    .filter((a) => a.title && a.link);
}

/** Latest articles for a sport. Returns [] (and logs) on any failure. */
export async function fetchFeed(sport: SportKey): Promise<Article[]> {
  const { code } = SPORTS[sport];
  let res: Response;
  try {
    res = await fetch(feedUrl(code), { next: { revalidate: FEED_TTL } });
  } catch (e) {
    console.error(`ESPN feed ${code} fetch failed:`, e);
    return [];
  }
  if (!res.ok) {
    console.error(`ESPN feed ${code}: ${res.status}`);
    return [];
  }
  try {
    return parseFeed(await res.text());
  } catch (e) {
    console.error(`ESPN feed ${code} parse failed:`, e);
    return [];
  }
}
