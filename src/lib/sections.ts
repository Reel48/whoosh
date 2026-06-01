/**
 * Single source of truth for the signed-in app's section structure.
 *
 * The signed-in experience is split into themed sections. Each section owns a
 * URL prefix, a `data-theme` scope (see globals.css), and a list of sub-pages.
 * Navigation surfaces (AppShell header, desktop sub-nav, mobile route strip,
 * bottom tab bar) all read from here instead of hardcoding link lists.
 *
 * This file is intentionally data-only (no JSX) so it can be imported by both
 * server and client components. Icons are resolved by key in the client nav
 * components.
 */

export type SectionKey = "capital" | "fantasy" | "pool" | "news";

export type NavItem = {
  href: string;
  label: string;
};

export type Section = {
  key: SectionKey;
  /** Short label shown on the hub and as the in-section title. */
  label: string;
  /** Section hub URL + the prefix that marks a route as "in" this section. */
  href: string;
  /** One-liner shown on the /home hub cards. */
  tagline: string;
  /** Sub-pages shown in the desktop sub-nav and mobile route strip. */
  nav: NavItem[];
  /** True once the section has real content; false renders a "coming soon". */
  live: boolean;
};

export const SECTIONS: Record<SectionKey, Section> = {
  capital: {
    key: "capital",
    label: "Capital",
    href: "/capital",
    tagline: "Your wallet, investing, and house wagers — all in Whoosh Bucks.",
    nav: [
      // /capital redirects to the wallet, which is the section's dashboard.
      { href: "/capital/wallet", label: "Wallet" },
      { href: "/capital/invest", label: "Invest" },
      { href: "/capital/events", label: "Events" },
      { href: "/capital/bets", label: "My bets" },
    ],
    live: true,
  },
  fantasy: {
    key: "fantasy",
    label: "Fantasy",
    href: "/fantasy",
    tagline: "Whoosh-run Sleeper leagues — standings, live matchups, and Whoosh Bucks on the line.",
    nav: [
      { href: "/fantasy", label: "Overview" },
      { href: "/fantasy/leagues", label: "Leagues" },
      { href: "/fantasy/rankings", label: "Rankings" },
      { href: "/fantasy/matchups", label: "Matchups" },
    ],
    live: true,
  },
  pool: {
    key: "pool",
    label: "Pool",
    href: "/pool",
    tagline: "Pool resources with the crew. Coming soon.",
    nav: [{ href: "/pool", label: "Overview" }],
    live: false,
  },
  news: {
    key: "news",
    label: "Sports News",
    href: "/news",
    tagline: "The latest headlines from ESPN — pick your sport and read the feed.",
    // Single page: the sport selector lives in the page body, so there's no
    // sub-nav (SectionSubNav/MobileRouteStrip render null for one nav item).
    nav: [{ href: "/news", label: "Overview" }],
    live: true,
  },
};

/**
 * Sections shown as cards on the /home hub. Capital is intentionally omitted as
 * a hub card — it's reached via its entry in the global SectionSwitcher (which
 * also shows live Total Equity). The Capital section itself (SECTIONS.capital)
 * stays fully defined so its pages and sub-nav keep working.
 */
export const SECTION_LIST: Section[] = [
  SECTIONS.fantasy,
  SECTIONS.news,
  SECTIONS.pool,
];

/** Which section (if any) a pathname belongs to, by URL prefix. */
export function sectionForPath(pathname: string): SectionKey | null {
  for (const s of Object.values(SECTIONS)) {
    if (pathname === s.href || pathname.startsWith(`${s.href}/`)) return s.key;
  }
  return null;
}
