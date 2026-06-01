import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getTotalEquityCents } from "@/lib/wb/dashboard";
import { formatWb } from "@/lib/wb/format";
import { Avatar } from "./Avatar";
import { SectionSwitcher } from "./SectionSwitcher";
import { SectionChrome } from "./app/SectionChrome";
import { SectionSubNav } from "./app/SectionSubNav";
import { MobileRouteStrip } from "./MobileRouteStrip";
import { BottomTabBar } from "./BottomTabBar";
import { SECTIONS, type SectionKey } from "@/lib/sections";

/**
 * Chrome for the signed-in app. Every surface (the /home hub and all four
 * sections) shares one persistent navigation:
 *
 * - Header: the Whoosh wordmark (→ hub) + a cross-section switcher so any
 *   section is one click away. Capital's switcher entry shows live Total
 *   Equity. Account chip on the right.
 * - Desktop sub-nav + mobile route strip: the CURRENT section's pages (only
 *   rendered when inside a section).
 * - Mobile bottom bar: the global section switcher (Home + the four sections).
 *
 * (This replaced the old forced-isolation model, where the only path between
 * sections was back through the hub.) Each section's `layout.tsx` wraps this in
 * a `data-theme` scope so the chrome adopts that section's styling.
 */
export async function AppShell({
  section,
  banner,
  children,
}: {
  section?: SectionKey;
  /** Optional full-width strip rendered between the header and the section's
   *  page-list nav (e.g. Capital's live market ticker). */
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const session = await getSession();
  // Total Equity for the Capital switcher entry (cheap; quotes are cached).
  // Null on failure so the header still renders.
  const equityCents = session
    ? await getTotalEquityCents(session.id).catch(() => null)
    : null;
  const equityLabel =
    equityCents != null ? formatWb(equityCents).replace(/^\$/, "") : null;

  const current = section ? SECTIONS[section] : null;
  // The page-list nav only renders for multi-page sections; single-page
  // sections (e.g. news) leave it null.
  const subNavLinks = current && current.nav.length > 1 ? current.nav : null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-4">
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

          <SectionSwitcher equityLabel={equityLabel} />

          <div className="flex flex-1 items-center justify-end gap-3">
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

      {/* The optional banner (e.g. Capital's market ticker) stays pinned just
          under the header the entire time; the page-list nav (desktop strip +
          mobile route strip) collapses away on scroll-down and returns on
          scroll-up. */}
      <SectionChrome
        banner={banner}
        nav={
          subNavLinks ? (
            <>
              <SectionSubNav links={subNavLinks} />
              <MobileRouteStrip links={subNavLinks} />
            </>
          ) : undefined
        }
      />

      {children}

      {/* Mobile bottom bar: the global section switcher, shown everywhere in the
          signed-in app (hub + sections). */}
      {session && <BottomTabBar activeSection={section ?? null} />}
    </>
  );
}
