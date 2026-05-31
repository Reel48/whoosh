import Link from "next/link";
import { requireSession, isPremium } from "@/lib/membership";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Bolt } from "@/components/Bolt";
import { SECTION_LIST, type SectionKey } from "@/lib/sections";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Home — Whoosh",
};

/** Sections that need a Premium subscription. Fantasy is sold per-league, so
 *  it stays open to any signed-in member. */
const PREMIUM_SECTIONS: ReadonlySet<SectionKey> = new Set(["capital", "pool"]);

/**
 * Signed-in section hub. After sign-in, members land here and choose a section —
 * Capital, Fantasy, or Pool. Each entry card is wrapped in that section's
 * `data-theme` scope so it previews the section's personality (font, border
 * weight, radius, surface) while drawing from the shared palette.
 *
 * Open to any signed-in member: Fantasy is reachable directly (per-league
 * paywall lives inside it), while Premium-only sections show an "Unlock" CTA
 * to non-subscribers instead of bouncing them.
 *
 * This page has no active section itself, so the AppShell switcher highlights
 * nothing and renders no sub-nav.
 */
export default async function Home() {
  const session = await requireSession("/home");
  const premium = await isPremium(session.id).catch(() => false);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-16">
        <div className="flex items-center gap-3">
          <Avatar
            id={session.id}
            hash={session.avatar}
            username={session.username}
            size={44}
            className="border-2 border-ink"
          />
          <div className="min-w-0">
            <p className="text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink/60">
              Welcome back
            </p>
            <p className="truncate font-heading text-xl font-black tracking-tight text-ink">
              @{session.username}
            </p>
          </div>
        </div>

        <h1 className="mt-8 font-heading text-4xl font-black tracking-tight sm:text-5xl">
          Where to today?
        </h1>
        <p className="mt-3 max-w-xl text-lg font-medium text-ink/70">
          Three sides of Whoosh, each its own world. Jump into one.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {SECTION_LIST.map((s) => {
            const locked = PREMIUM_SECTIONS.has(s.key) && !premium;
            // Locked Premium sections send non-subscribers to the upsell rather
            // than into a section that would just bounce them back.
            const href = locked ? "/#plans" : s.href;
            return (
              <Link
                key={s.key}
                href={href}
                data-theme={s.key}
                className="group flex flex-col gap-4 rounded-theme border-theme border-ink/10 bg-surface p-7 shadow-theme transition-transform hover:-translate-y-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <Bolt className="h-9 w-9 text-ink" />
                  {locked ? (
                    <span className="rounded-full border-theme border-ink/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/50">
                      Premium
                    </span>
                  ) : (
                    !s.live && (
                      <span className="rounded-full border-theme border-ink/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/50">
                        Soon
                      </span>
                    )
                  )}
                </div>
                <div>
                  <h2 className="font-display text-3xl font-black tracking-tight text-ink">
                    {s.label}
                  </h2>
                  <p className="mt-2 text-sm font-medium text-ink/70">{s.tagline}</p>
                </div>
                <span className="mt-auto inline-flex w-fit items-center gap-2 font-display text-sm font-bold text-ink">
                  {locked ? "Unlock" : s.live ? "Enter" : "Preview"}
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
