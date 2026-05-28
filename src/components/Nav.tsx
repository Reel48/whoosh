import Image from "next/image";
import { getSession } from "@/lib/session";
import { isGuildMember } from "@/lib/discord";
import { Bolt } from "./Bolt";
import { Avatar } from "./Avatar";

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

export async function Nav() {
  const session = await getSession();
  const inServer = session
    ? await isGuildMember(session.id).catch(() => false)
    : false;
  const discordLabel = inServer ? "Open Discord" : "Join the Discord";

  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-white-smoke/95 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="block" aria-label="Whoosh — home">
          <Image
            src="/whoosh-wordmark-ink.svg"
            alt="Whoosh"
            width={1440}
            height={368}
            className="h-6 w-auto"
            priority
          />
        </a>

        <div className="flex items-center gap-5 text-sm font-semibold sm:gap-7">
          <a href="/#channels" className="hidden hover:underline sm:inline">
            Channels
          </a>
          <a href="/#plans" className="hidden hover:underline sm:inline">
            Plans
          </a>
          <a href="/#faq" className="hidden hover:underline sm:inline">
            FAQ
          </a>

          {session ? (
            <a
              href="/account"
              className="flex items-center gap-2 rounded-full border-2 border-ink bg-white-smoke py-1 pl-1 pr-3 transition-colors hover:bg-mango"
            >
              <Avatar id={session.id} hash={session.avatar} username={session.username} size={28} />
              <span className="hidden text-sm sm:inline">@{session.username}</span>
            </a>
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
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-4 py-2 text-white-smoke transition-colors hover:bg-blue hover:text-ink"
          >
            <Bolt className="h-4 w-4" /> {discordLabel}
          </a>
        </div>
      </nav>
    </header>
  );
}
