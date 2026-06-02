"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** useLayoutEffect on the client, useEffect on the server (no SSR warning). */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Props = {
  /** Position in the cascade — drives the stagger delay. */
  index?: number;
  /** Per-item stagger step in ms. */
  stepMs?: number;
  className?: string;
  children: React.ReactNode;
};

/**
 * Reveals its children with a short fade + rise the first time they enter the
 * viewport, staggered by `index`. Used on the /home dashboard so cards arrive in
 * a cascade instead of popping in all at once.
 *
 * Default-visible: server and first client render are fully visible (so there's
 * no hydration mismatch and nothing can get stuck hidden). A layout effect then
 * hides the element before paint — only when motion is allowed — and an
 * IntersectionObserver reveals it on entry. If `prefers-reduced-motion` is set
 * (or there's no observer / JS is slow), children just stay visible.
 */
export function Reveal({ index = 0, stepMs = 60, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);

  useIsomorphicLayoutEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;
    if (reduce || !el || typeof IntersectionObserver === "undefined") return;

    setShown(false); // before paint — no flash
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(8px)",
        transition: "opacity 0.45s ease-out, transform 0.45s ease-out",
        transitionDelay: shown ? `${index * stepMs}ms` : "0ms",
        willChange: shown ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
