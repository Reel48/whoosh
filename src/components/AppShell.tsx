import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { Avatar } from "./Avatar";
import { NotificationsBell } from "./NotificationsBell";
import { SectionSubNav } from "./app/SectionSubNav";
import { MobileRouteStrip } from "./MobileRouteStrip";
import { BottomTabBar } from "./BottomTabBar";
import { SECTIONS, type SectionKey } from "@/lib/sections";

function BackArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/**
 * Chrome for the signed-in app sections. The sections are deliberately
 * isolated: once inside one, the only way to another is back through the
 * /home hub — there is NO cross-section switcher anywhere in the shell.
 *
 * - Inside a section (`section` set): the header shows a "Home" back button
 *   and the section title; the section's own pages appear in the desktop
 *   sub-nav, mobile route strip, and bottom tab bar. No links to other
 *   sections.
 * - On the /home hub (`section` omitted): just the logo + account. The hub
 *   page body is where sections are chosen. No sub-nav, no bottom bar.
 *
 * Each section's `layout.tsx` wraps this in a `data-theme` scope so all of
 * the chrome adopts that section's styling.
 */
export async function AppShell({
  section,
  children,
}: {
  section?: SectionKey;
  children: React.ReactNode;
}) {
  const session = await getSession();

  const current = section ? SECTIONS[section] : null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-4">
          {current ? (
            // Inside a section: a single way out — back to the hub.
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/home"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-theme border-theme border-ink/15 px-3 py-1.5 text-sm font-display font-bold text-ink transition-colors hover:bg-ink/5"
              >
                <BackArrow className="h-4 w-4" />
                Home
              </Link>
              <span className="hidden h-5 w-px bg-ink/15 sm:block" />
              <span className="truncate font-display text-base font-black tracking-tight text-ink">
                {current.label}
              </span>
            </div>
          ) : (
            // On the hub: the wordmark.
            <Link href="/home" className="block shrink-0" aria-label="Whoosh — home">
              <Image
                src="/whoosh-wordmark-ink.svg"
                alt="Whoosh"
                width={1440}
                height={368}
                className="h-6 w-auto"
                priority
              />
            </Link>
          )}

          <div className="flex flex-1 items-center justify-end gap-3">
            {session && <NotificationsBell />}

            {session && (
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-theme border-theme border-ink/15 py-1 pl-1 pr-3 transition-colors hover:bg-ink/5"
              >
                <Avatar avatarUrl={session.avatarUrl} username={session.username} size={28} />
                <span className="hidden text-sm sm:inline">@{session.username}</span>
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Section-internal navigation only — never other sections. */}
      {current && (
        <>
          <SectionSubNav links={current.nav} />
          <MobileRouteStrip links={current.nav} />
        </>
      )}

      {children}

      {/* Bottom tab bar is section-internal (Home · section tabs · Account) and
          only appears inside a section. */}
      {current && <BottomTabBar section={current.key} />}
    </>
  );
}
