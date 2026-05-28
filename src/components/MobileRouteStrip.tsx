"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/wallet", label: "Wallet" },
  { href: "/invest", label: "Invest" },
  { href: "/events", label: "Events" },
  { href: "/account", label: "Account" },
];

// Always show the strip while scroll is within this many px of the top.
// Avoids a flash-hide when the user just bounces the page.
const PINNED_THRESHOLD = 80;
// Minimum scroll delta in either direction before we react. Filters out
// tiny one-pixel jitter (rubber-band scrolling on iOS).
const MIN_DELTA = 6;

/**
 * Thin horizontal strip rendered just under the main Nav on mobile for
 * signed-in users. Shows the four primary signed-in surfaces with an
 * active-route indicator.
 *
 * On scroll-down: slides up behind the main nav (lower z-index than the
 * nav, transform: translateY(-100%) hides it behind the nav's blur layer).
 * On scroll-up: slides back into view.
 * Always shown when within PINNED_THRESHOLD of the top.
 *
 * Hidden on sm+ — desktop uses the top nav's NavLinks for the same purpose.
 */
export function MobileRouteStrip() {
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

  return (
    <div
      // The strip sits at `top: 65px` (just below the main nav). When
      // `hidden` is true, we translate it up by its own height so it slides
      // behind the nav's backdrop-blur and disappears. Lower z-index than
      // the nav (z-20 vs z-30) keeps it tucked below during the transition.
      className={`sticky top-[65px] z-20 border-b-2 border-ink bg-white-smoke transition-transform duration-200 ease-out sm:hidden ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
      aria-hidden={hidden}
    >
      <nav
        className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-4 py-2"
        aria-label="Primary"
      >
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              tabIndex={hidden ? -1 : undefined}
              className={`chip-tap shrink-0 rounded-full border-2 border-ink px-4 text-sm font-bold tap-press ${
                active ? "bg-ink text-white-smoke" : "bg-white-smoke text-ink"
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
