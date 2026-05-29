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

export type NavItem = {
  href: string;
  label: string;
};

export type Section = {
  key: SectionKey;
  /** Short label for switchers/tabs. */
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
      { href: "/capital", label: "Home" },
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
    tagline: "Fantasy football, the Whoosh way. Coming soon.",
    nav: [{ href: "/fantasy", label: "Home" }],
    live: false,
  },
  pool: {
    key: "pool",
    label: "Pool",
    href: "/pool",
    tagline: "Pool resources with the crew. Coming soon.",
    nav: [{ href: "/pool", label: "Home" }],
    live: false,
  },
};

/** Ordered list for switchers and the hub. */
export const SECTION_LIST: Section[] = [
  SECTIONS.capital,
  SECTIONS.fantasy,
  SECTIONS.pool,
];

/** Which section (if any) a pathname belongs to, by URL prefix. */
export function sectionForPath(pathname: string): SectionKey | null {
  for (const s of SECTION_LIST) {
    if (pathname === s.href || pathname.startsWith(`${s.href}/`)) return s.key;
  }
  return null;
}
