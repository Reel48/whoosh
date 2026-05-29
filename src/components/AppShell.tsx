import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { hasAdminRole } from "@/lib/discord";
import { Avatar } from "./Avatar";
import { NotificationsBell } from "./NotificationsBell";
import { SectionSwitcher } from "./app/SectionSwitcher";
import { SectionSubNav } from "./app/SectionSubNav";
import { MobileRouteStrip } from "./MobileRouteStrip";
import { BottomTabBar } from "./BottomTabBar";
import { SECTIONS, type SectionKey } from "@/lib/sections";

/**
 * Chrome for the signed-in app sections. Renders the global header (logo →
 * hub, section switcher, notifications, account), the current section's
 * sub-navigation (desktop strip + mobile route strip), and the global bottom
 * tab bar. Each section's `layout.tsx` wraps this in a `data-theme` scope so
 * all of the above adopts that section's structural styling.
 *
 * `section` is omitted for the /home hub and /account, which have no active
 * section — the switcher then highlights nothing and no sub-nav renders.
 */
export async function AppShell({
  section,
  children,
}: {
  section?: SectionKey;
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isAdmin = session
    ? await hasAdminRole(session.id).catch(() => false)
    : false;

  const nav = section ? SECTIONS[section].nav : [];

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

          <div className="flex-1">
            <SectionSwitcher />
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden rounded-theme border-theme border-ink bg-ink px-3 py-1 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 sm:inline"
              >
                Admin
              </Link>
            )}

            {session && <NotificationsBell />}

            {session && (
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-theme border-theme border-ink/15 py-1 pl-1 pr-3 transition-colors hover:bg-ink/5"
              >
                <Avatar id={session.id} hash={session.avatar} username={session.username} size={28} />
                <span className="hidden text-sm sm:inline">@{session.username}</span>
              </Link>
            )}
          </div>
        </nav>
      </header>

      <SectionSubNav links={nav} />
      <MobileRouteStrip links={nav} />

      {children}

      <BottomTabBar />
    </>
  );
}
