"use client";

import { useEffect, useRef, useState } from "react";

// Always show the bar while scroll is within this many px of the top, so a
// small bounce near the top never hides it.
const PINNED_THRESHOLD = 80;
// Minimum scroll delta in either direction before we react — filters out the
// one-pixel jitter of iOS rubber-band scrolling.
const MIN_DELTA = 6;

/**
 * Sticky wrapper for the news section's secondary chrome — the live-score
 * ticker and the feed selector. Without this they sit in normal flow and
 * scroll away for good, so the reader has to return all the way to the top to
 * get them back.
 *
 * Mirrors MobileRouteStrip's behaviour: the bar slides up behind the (opaque,
 * higher-z) AppShell header on scroll-down and returns the instant the reader
 * scrolls up. `top-[65px]` pins it just under the header; `-translate-y-full`
 * tucks it fully behind the header regardless of its height.
 */
export function NewsRevealBar({ children }: { children: React.ReactNode }) {
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
      className={`sticky top-[65px] z-20 border-b border-ink/10 bg-white transition-transform duration-200 ease-out ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
      aria-hidden={hidden}
    >
      {children}
    </div>
  );
}
