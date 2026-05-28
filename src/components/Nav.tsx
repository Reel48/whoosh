import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { isGuildMember, hasAdminRole } from "@/lib/discord";
import { isPremium } from "@/lib/membership";
import { Bolt } from "./Bolt";
import { Avatar } from "./Avatar";
import { NavLinks } from "./NavLinks";
import { MobileMenu } from "./MobileMenu";
import { NotificationsBell } from "./NotificationsBell";
import { MobileRouteStrip } from "./MobileRouteStrip";
import { BottomTabBar } from "./BottomTabBar";

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

export async function Nav() {
  const session = await getSession();
  const [inServer, isAdmin, premium] = session
    ? await Promise.all([
        isGuildMember(session.id).catch(() => false),
        hasAdminRole(session.id).catch(() => false),
        isPremium(session.id).catch(() => false),
      ])
    : [false, false, false];
  const discordLabel = inServer ? "Open Discord" : "Join the Discord";
  // Premium members get a logo-link straight to their dashboard; everyone else
  // (anon + signed-in non-premium) lands on the marketing home.
  const logoHref = premium ? "/home" : "/";

  return (
    <>
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-white-smoke/95 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href={logoHref} className="block" aria-label="Whoosh — home">
          <Image
            src="/whoosh-wordmark-ink.svg"
            alt="Whoosh"
            width={1440}
            height={368}
            className="h-6 w-auto"
            priority
          />
        </Link>

        <div className="flex items-center gap-5 text-sm font-semibold sm:gap-7">
          <NavLinks signedIn={!!session} />

          {isAdmin && (
            <Link
              href="/admin"
              className="hidden rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-bold uppercase tracking-wider text-white-smoke hover:opacity-90 sm:inline"
            >
              Admin
            </Link>
          )}

          {session && <NotificationsBell />}

          {session ? (
            <Link
              href="/account"
              className="flex items-center gap-2 rounded-full border-2 border-ink bg-white-smoke py-1 pl-1 pr-3 transition-colors hover:bg-ink/5"
            >
              <Avatar id={session.id} hash={session.avatar} username={session.username} size={28} />
              <span className="hidden text-sm sm:inline">@{session.username}</span>
            </Link>
          ) : (
            <a
              href="/api/auth/discord?next=/account"
              className="hidden hover:underline sm:inline"
            >
              Sign in
            </a>
          )}

          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-full border-2 border-ink bg-ink px-4 py-2 text-white-smoke transition-opacity hover:opacity-90 sm:inline-flex"
          >
            <Bolt className="h-4 w-4" /> {discordLabel}
          </a>

          <MobileMenu
            signedIn={!!session}
            isAdmin={isAdmin}
            username={session?.username ?? null}
          />
        </div>
      </nav>
    </header>
    {session && <MobileRouteStrip />}
    {session && <BottomTabBar />}
    </>
  );
}
