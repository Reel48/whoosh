"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavItem } from "@/lib/sections";

// Always show the strip while scroll is within this many px of the top.
// Avoids a flash-hide when the user just bounces the page.
const PINNED_THRESHOLD = 80;
// Minimum scroll delta in either direction before we react. Filters out
// tiny one-pixel jitter (rubber-band scrolling on iOS).
const MIN_DELTA = 6;

/**
 * Thin horizontal strip rendered just under the AppShell header on mobile,
 * showing the current section's pages with an active-route indicator. Driven
 * by the section config (passed as `links`) rather than a hardcoded list.
 *
 * On scroll-down it slides up behind the header; on scroll-up it returns;
 * always shown within PINNED_THRESHOLD of the top. Hidden on sm+ (desktop
 * uses SectionSubNav). Single-page sections render nothing.
 */
export function MobileRouteStrip({ links }: { links: NavItem[] }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY.current;
        if (y < PINNED_THRESHOLD) {
          setHidden(false);
        } else if (Math.abs(dy) >= MIN_DELTA) {
          setHidden(dy > 0);
        }
        lastY.current = y;
        ticking.current = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (links.length <= 1) return null;

  // The first nav item is the section root (Overview); exact-match only.
  const rootHref = links[0]?.href;

  return (
    <div
      // Sits at top: 65px (just below the header). When `hidden`, translate up
      // by its own height so it slides behind the header's backdrop-blur.
      className={`sticky top-[65px] z-20 border-b border-ink/10 bg-white/95 backdrop-blur transition-transform duration-200 ease-out sm:hidden ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
      aria-hidden={hidden}
    >
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
              tabIndex={hidden ? -1 : undefined}
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
