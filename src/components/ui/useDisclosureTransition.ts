"use client";

import { useEffect, useState } from "react";

/**
 * Drives the transitions.dev open/close pattern (`t-dropdown` / `t-modal`):
 * keep the element mounted through its exit and toggle `is-open` / `is-closing`.
 *
 * Given the caller's `open` boolean, returns `mounted` (render the element while
 * true) and `stateClass` (`"is-open"` or `"is-closing"`). On close it flips to
 * `is-closing`, then unmounts after `closeMs` — a timeout, not `transitionend`,
 * so it still fires under prefers-reduced-motion (where the transition is zeroed).
 *
 * setState runs only inside rAF / timeout callbacks to satisfy the repo's
 * react-hooks/set-state-in-effect rule.
 */
export function useDisclosureTransition(open: boolean, closeMs = 150) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        setMounted(true);
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    const raf = requestAnimationFrame(() => setShown(false));
    const t = window.setTimeout(() => setMounted(false), closeMs);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [open, closeMs]);

  return { mounted, stateClass: shown ? "is-open" : "is-closing" } as const;
}
