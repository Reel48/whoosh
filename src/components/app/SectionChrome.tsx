"use client";

import { useEffect, useRef, useState } from "react";

// Always reveal the nav while scroll is within this many px of the top, so a
// small bounce near the top never hides it.
const PINNED_THRESHOLD = 80;
// Minimum scroll delta in either direction before we react — filters out the
// one-pixel jitter of iOS rubber-band scrolling.
const MIN_DELTA = 6;

/** True while the reader is scrolling down (away from the top); flips back the
 *  instant they scroll up or return near the top. */
function useHideOnScrollDown(): boolean {
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

  return hidden;
}

/**
 * Sticky chrome that pins a section's secondary bar just under the AppShell
 * header. The `banner` (Capital's market ticker, the news scoreboard) stays
 * pinned the entire time; the `nav` (page-list / feed selector) slides up
 * behind the banner on scroll-down and slides back on scroll-up.
 *
 * The reveal is a transform — not a height collapse — on purpose: a transform
 * doesn't change document height, so collapsing the nav near the bottom of a
 * short page can't clamp the scroll and re-trigger itself. The banner is opaque
 * and painted above the nav (z-10 over z-0), so the nav tucks fully behind it
 * (and the header). The wrapper is `pointer-events-none` with its children
 * re-enabled, so the space the nav vacates passes clicks through to the page
 * rather than blocking them with an invisible box.
 */
export function SectionChrome({
  banner,
  nav,
}: {
  banner?: React.ReactNode;
  nav?: React.ReactNode;
}) {
  const hidden = useHideOnScrollDown();
  if (!banner && !nav) return null;

  return (
    <div className="pointer-events-none sticky top-[65px] z-20">
      {banner && <div className="pointer-events-auto relative z-10">{banner}</div>}
      {nav && (
        <div
          className={`pointer-events-auto relative z-0 transition-transform duration-200 ease-out ${
            hidden ? "-translate-y-full" : "translate-y-0"
          }`}
          aria-hidden={hidden}
          inert={hidden || undefined}
        >
          {nav}
        </div>
      )}
    </div>
  );
}
