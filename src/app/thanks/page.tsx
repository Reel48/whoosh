import Image from "next/image";
import { Nav } from "@/components/Nav";
import { Bolt } from "@/components/Bolt";

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

export const metadata = {
  title: "You're in — Whoosh",
};

export default function Thanks() {
  return (
    <>
      <Nav />
      <main className="flex flex-1 flex-col items-center justify-center bg-lime px-6 py-24 text-center text-ink">
        <Image
          src="/whoosh-wordmark-ink.svg"
          alt="Whoosh"
          width={1440}
          height={368}
          className="h-7 w-auto"
          priority
        />
        <div className="mt-10 flex h-20 w-20 items-center justify-center rounded-full border-2 border-ink bg-ink">
          <Bolt className="h-10 w-10 text-white-smoke" />
        </div>
        <h1 className="mt-8 font-heading text-5xl font-black tracking-tight sm:text-6xl">
          You&rsquo;re in.
        </h1>
        <p className="mt-4 max-w-md text-lg font-medium text-ink/80">
          Welcome to Whoosh Premium. Hop into Discord and the members-only
          channels are yours.
        </p>
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-9 inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-7 py-3.5 text-base font-bold text-white-smoke transition-opacity hover:opacity-90"
        >
          <Bolt className="h-5 w-5" /> Open Discord
        </a>
        <a
          href="/account"
          className="mt-4 text-sm font-bold text-ink underline underline-offset-4 hover:no-underline"
        >
          View your account
        </a>
      </main>
    </>
  );
}
