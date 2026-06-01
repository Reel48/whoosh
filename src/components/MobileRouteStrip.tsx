"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/sections";

/**
 * Thin horizontal strip rendered just under the AppShell header on mobile,
 * showing the current section's pages with an active-route indicator. Driven
 * by the section config (passed as `links`) rather than a hardcoded list.
 *
 * Stays pinned at `top-[65px]` the entire time — it never hides on scroll,
 * matching the always-sticky desktop SectionSubNav. Hidden on sm+ (desktop
 * uses SectionSubNav). Single-page sections render nothing.
 */
export function MobileRouteStrip({ links }: { links: NavItem[] }) {
  const pathname = usePathname();
  if (links.length <= 1) return null;

  // The first nav item is the section root (Overview); exact-match only.
  const rootHref = links[0]?.href;

  return (
    <div className="sticky top-[65px] z-20 border-b border-ink/10 bg-white/95 backdrop-blur sm:hidden">
      <nav
        className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-4 py-2"
        aria-label="Section pages"
      >
        {links.map((l) => {
          const active =
            pathname === l.href ||
            (l.href !== rootHref && pathname.startsWith(`${l.href}/`));
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`chip-tap shrink-0 rounded-theme border-theme px-4 font-display text-sm font-bold tap-press ${
                active
                  ? "border-ink bg-ink text-white"
                  : "border-ink/15 bg-white text-ink"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
