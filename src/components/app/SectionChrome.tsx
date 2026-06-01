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
 * Sticky chrome parked just under the AppShell header, holding a section's
 * secondary bar — the `banner` (Capital's market ticker, the news scoreboard)
 * and the `nav` (page-list / feed selector). The whole group slides up behind
 * the header on scroll-down to give the page back its space, and slides back
 * the moment the reader scrolls up.
 *
 * The hide is a transform — not a height collapse — on purpose: a transform
 * doesn't change document height, so hiding the group near the bottom of a
 * short page can't clamp the scroll and re-trigger itself. `translateY(-100%)`
 * tucks the group up by its own height so its bottom edge lands at the header's
 * (opaque, higher-z) bottom — fully hidden regardless of how tall it is. The
 * transform is set inline rather than via a Tailwind translate utility because
 * this build's CSS pipeline doesn't emit the negative translate class.
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
    <div
      className="sticky top-[65px] z-20"
      style={{
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 200ms ease-out",
      }}
      aria-hidden={hidden}
      inert={hidden || undefined}
    >
      {banner}
      {nav}
    </div>
  );
}
