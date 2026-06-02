"use client";

import { useEffect, useRef, useState } from "react";
import { formatWb, formatUsd } from "@/lib/wb/format";

type Props = {
  /** The target value, in cents (WB or USD). */
  valueCents: number;
  /** Which currency formatter to use. Defaults to WB. */
  currency?: "wb" | "usd";
  /** Prefix positive values with "+" (reads as a delta). */
  signed?: boolean;
  /** Decimal places (WB only). */
  decimals?: 0 | 2;
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
 * Formatting happens inside this client component from serializable props
 * (`currency` / `signed` / `decimals`) — a Server Component must not pass a
 * formatter function across the boundary, so the choice is passed as data and
 * `formatWb` / `formatUsd` are applied here.
 *
 * Starts at 0 by design: server and first client render show 0, which is simply
 * the start of the count-up — no hydration mismatch and no flash.
 */
export function Ticker({
  valueCents,
  currency = "wb",
  signed = false,
  decimals = 2,
  className,
  durationMs = 600,
}: Props) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const currentRef = useRef(0);

  useEffect(() => {
    const dur = prefersReducedMotion() ? 0 : durationMs;
    const from = fromRef.current;
    const to = valueCents;
    // Wall-clock start, so a late-resuming rAF (e.g. tab refocused) computes the
    // correct progress instead of restarting the roll.
    const start = performance.now();

    let raf = 0;
    let done = false;
    const set = (v: number) => {
      currentRef.current = v;
      setDisplay(v); // inside rAF / timeout callback — not a synchronous effect setState
    };
    const finish = () => {
      if (done) return;
      done = true;
      fromRef.current = to;
      set(to);
    };
    const frame = () => {
      const t = dur <= 0 ? 1 : Math.min(1, (performance.now() - start) / dur);
      if (t >= 1) {
        finish();
      } else {
        set(Math.round(from + (to - from) * easeOut(t)));
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    // rAF is paused in hidden/background tabs, which would leave the value stuck
    // at its start (a wrong amount for a money figure). Timers still fire when
    // hidden, so this guarantees the final value lands regardless.
    const fallback = window.setTimeout(finish, dur + 200);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      // Resume from wherever the (possibly interrupted) roll left off.
      fromRef.current = currentRef.current;
    };
  }, [valueCents, durationMs]);

  const text =
    currency === "usd"
      ? formatUsd(display, { signed })
      : formatWb(display, { signed, decimals });

  return <span className={className}>{text}</span>;
}
