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

export type SectionKey = "capital" | "fantasy" | "pool";

/** Icon keys resolved to SVGs in the client nav components. */
export type IconKey =
  | "wallet"
  | "invest"
  | "events"
  | "bets"
  | "overview"
  | "leagues"
  | "matchups"
  | "rankings";

export type NavItem = {
  href: string;
  label: string;
};

export type TabItem = NavItem & {
  icon: IconKey;
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
  /**
   * Curated subset shown in the mobile bottom tab bar (between the Home and
   * Account tabs). Empty for placeholder sections. Kept small (≤3) so the bar
   * stays uncluttered — the full set lives in `nav`.
   */
  tabs: TabItem[];
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
      { href: "/capital", label: "Overview" },
      { href: "/capital/wallet", label: "Wallet" },
      { href: "/capital/invest", label: "Invest" },
      { href: "/capital/events", label: "Events" },
      { href: "/capital/bets", label: "My bets" },
    ],
    tabs: [
      { href: "/capital/wallet", label: "Wallet", icon: "wallet" },
      { href: "/capital/invest", label: "Invest", icon: "invest" },
      { href: "/capital/events", label: "Events", icon: "events" },
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
    tabs: [
      { href: "/fantasy/leagues", label: "Leagues", icon: "leagues" },
      { href: "/fantasy/rankings", label: "Rankings", icon: "rankings" },
      { href: "/fantasy/matchups", label: "Matchups", icon: "matchups" },
    ],
    live: true,
  },
  pool: {
    key: "pool",
    label: "Pool",
    href: "/pool",
    tagline: "Pool resources with the crew. Coming soon.",
    nav: [{ href: "/pool", label: "Overview" }],
    tabs: [],
    live: false,
  },
};

/**
 * Sections shown as cards on the /home hub. Capital is intentionally omitted —
 * it's reached via the Total Equity pill in the app navbar (AppShell), not a
 * hub card. The Capital section itself (SECTIONS.capital) stays fully defined
 * so its pages, sub-nav, and bottom tab bar keep working.
 */
export const SECTION_LIST: Section[] = [
  SECTIONS.fantasy,
  SECTIONS.pool,
];

/** Which section (if any) a pathname belongs to, by URL prefix. */
export function sectionForPath(pathname: string): SectionKey | null {
  for (const s of Object.values(SECTIONS)) {
    if (pathname === s.href || pathname.startsWith(`${s.href}/`)) return s.key;
  }
  return null;
}
