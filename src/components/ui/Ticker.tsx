"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  /** The target value, in cents (WB or USD). */
  valueCents: number;
  /** Formats a cents amount for display — pass `formatWb` / `formatUsd`. */
  format: (cents: number) => string;
  className?: string;
  /** Roll duration in ms. */
  durationMs?: number;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Ease-out cubic — fast start, gentle settle. Matches the UI default. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animated number ticker. Counts up from 0 on first mount and re-rolls from the
 * previous value to `valueCents` whenever the target changes (e.g. after a buy /
 * wager / transfer updates a balance). Keep `tabular-nums` on the element (via
 * `className`) so digits don't reflow as they roll. Honors
 * `prefers-reduced-motion` by snapping straight to the value.
 *
 * Starts at 0 by design: server and first client render show 0, which is simply
 * the start of the count-up — no hydration mismatch and no flash.
 */
export function Ticker({ valueCents, format, className, durationMs = 600 }: Props) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const currentRef = useRef(0);

  useEffect(() => {
    const dur = prefersReducedMotion() ? 0 : durationMs;
    const from = fromRef.current;
    const to = valueCents;

    let raf = 0;
    let startTs: number | undefined;
    const tick = (ts: number) => {
      if (startTs === undefined) startTs = ts;
      const t = dur <= 0 ? 1 : Math.min(1, (ts - startTs) / dur);
      const value = Math.round(from + (to - from) * easeOut(t));
      currentRef.current = value;
      setDisplay(value); // inside rAF callback — not a synchronous effect setState
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      // Resume from wherever the (possibly interrupted) roll left off.
      fromRef.current = currentRef.current;
    };
  }, [valueCents, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
