import type { Metadata } from "next";

/**
 * Standalone landing shell for the pool sign-up funnel.
 *
 * Deliberately bare: no <Nav>, no footer, no links anywhere back into
 * whoosh.business or the signed-in app. A visitor who lands here has exactly
 * two paths — pay for a pool, or leave. Everything after payment points at
 * Sleeper, where the pools are actually played.
 */
export const metadata: Metadata = {
  title: "Join the Whoosh NFL pools",
  description:
    "Whoosh Survivor and Pick 'Em for the 2026 NFL season. Pay once, get your Sleeper invite instantly.",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col bg-white-smoke text-ink">{children}</div>;
}
