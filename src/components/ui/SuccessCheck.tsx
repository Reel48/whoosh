/**
 * transitions.dev success check (t-success-check). Renders a checkmark that
 * fades + rotates upright + bobs + draws its stroke. `data-state="in"` is static
 * so the appear animation plays on mount — used in server-rendered success
 * banners that appear after a post-action redirect (no client JS needed).
 * Reduced-motion is handled by the t-success-check guard in globals.css.
 *
 * Sized for the Capital `.alert .icon` slot; stroke inherits the banner color.
 */
export function SuccessCheck({ className = "" }: { className?: string }) {
  return (
    <span className={`t-success-check icon ${className}`} data-state="in" aria-hidden="true">
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
        <path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
