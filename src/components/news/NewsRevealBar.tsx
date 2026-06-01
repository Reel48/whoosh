/**
 * Sticky wrapper for the news section's secondary chrome — the live-score
 * ticker and the feed selector. Without this they sit in normal flow and
 * scroll away for good, so the reader has to return all the way to the top to
 * get them back.
 *
 * Stays pinned the entire time: `top-[65px]` parks it just under the (opaque,
 * higher-z) AppShell header and it never hides on scroll. (It used to slide up
 * behind the header on scroll-down; that reveal behaviour was removed so the
 * bar — like the Capital sub-nav — is always available.)
 */
export function NewsRevealBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-[65px] z-20 border-b border-ink/10 bg-white">
      {children}
    </div>
  );
}
