/**
 * transitions.dev shimmer text (t-shimmer) — a loading / in-progress label that
 * shimmers instead of using a spinner. Pure CSS; `data-text` must mirror the
 * visible string so the ::before gradient masks the same glyphs. Reduced-motion
 * is handled by the t-shimmer guard in globals.css.
 */
export function Shimmer({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span className={`t-shimmer ${className}`} data-text={children}>
      {children}
    </span>
  );
}
