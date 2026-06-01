import Link from "next/link";
import { requireSession } from "@/lib/membership";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Bolt } from "@/components/Bolt";
import { ScoreTicker } from "@/components/news/ScoreTicker";
import { SECTION_LIST, type Section } from "@/lib/sections";
import { getGuildOnlineCount, isGuildMember } from "@/lib/discord";
import { getLink } from "@/lib/fantasy/link";
import { getCrossLeagueScoreboard } from "@/lib/fantasy/rankings";
import { fetchFeed, DEFAULT_SPORT } from "@/lib/news/espn";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Home — Whoosh",
};

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

/** Small color accents so each section card reads as its own thing while the
 *  body stays calm. All values are from the shared palette (globals.css). */
const SECTION_ACCENT: Record<string, { dot: string; text: string }> = {
  fantasy: { dot: "bg-blue", text: "text-blue" },
  news: { dot: "bg-safety-orange", text: "text-safety-orange" },
  pool: { dot: "bg-lavender", text: "text-lavender" },
};

/**
 * Signed-in command center. The post-login landing: a vivid color-block hero
 * that greets the member, a live-scores ticker, then calm, data-backed cards
 * for each section (Fantasy, News, Pool). Capital is intentionally absent — it
 * lives behind the navbar equity pill (see AppShell), not here.
 */
export default async function Home() {
  const session = await requireSession("/home");

  const [onlineCount, inServer, link, board, topArticle] = await Promise.all([
    getGuildOnlineCount().catch(() => null),
    session.discordUserId
      ? isGuildMember(session.discordUserId).catch(() => false)
      : Promise.resolve(false),
    getLink(session.id).catch(() => null),
    getCrossLeagueScoreboard().catch(() => ({ rows: [], leagues: [] })),
    fetchFeed(DEFAULT_SPORT)
      .then((a) => a[0] ?? null)
      .catch(() => null),
  ]);

  const discordLabel = inServer ? "Open the Discord" : "Join the Discord";

  // Fantasy snapshot for that section's card.
  const myRow = link ? board.rows.find((r) => r.ownerId === link.sleeperUserId) ?? null : null;
  const leader = board.rows[0] ?? null;

  /** The one live stat each card carries under its tagline. */
  function statFor(s: Section): string {
    if (s.key === "fantasy") {
      if (!link) return "Link your Sleeper to track your team →";
      if (myRow) return `You're #${myRow.rank} of ${board.rows.length} across all leagues`;
      if (leader) return `${leader.ownerName} leads the power rankings`;
      return s.tagline;
    }
    if (s.key === "news") {
      return topArticle ? topArticle.title : s.tagline;
    }
    return s.tagline;
  }

  return (
    <AppShell>
      {/* Hero — lime color block; the whole band opens the Discord. */}
      <section className="mt-10 border-b-2 border-t-2 border-ink bg-lime sm:mt-14">
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative mx-auto block w-full max-w-5xl overflow-hidden px-6 py-12 transition-opacity hover:opacity-95 sm:py-16"
        >
          <div className="hatch pointer-events-none absolute inset-0 text-ink/10" />
          <div className="relative">
            <div className="flex items-center gap-3.5">
              <Avatar
                avatarUrl={session.avatarUrl}
                username={session.username}
                size={52}
                className="border-2 border-ink"
              />
              <div className="min-w-0">
                <p className="text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink/70">
                  Hello
                </p>
                <p className="truncate font-heading text-3xl font-black tracking-tight text-ink sm:text-4xl">
                  @{session.username}
                </p>
              </div>
            </div>

            {onlineCount != null && onlineCount > 0 && (
              <div className="mt-7">
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white-smoke px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-ink">
                  <span className="inline-flex h-2 w-2 rounded-full border border-ink bg-pigment-green" />
                  {onlineCount.toLocaleString()} online now
                </span>
              </div>
            )}
          </div>
        </a>
      </section>

      {/* Live scores — self-contained; renders nothing on a quiet day. */}
      <ScoreTicker />

      {/* Calm body — live section cards. */}
      <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
        <div className="grid gap-5 sm:grid-cols-2">
          {SECTION_LIST.map((s) => {
            const accent = SECTION_ACCENT[s.key] ?? { dot: "bg-ink", text: "text-ink" };
            return (
              <Link
                key={s.key}
                href={s.href}
                data-theme={s.key}
                className="group flex flex-col gap-4 rounded-theme border-theme border-ink/10 bg-white p-7 shadow-theme transition-transform hover:-translate-y-1"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2.5">
                    <span className={`h-3 w-3 rounded-full border-2 border-ink ${accent.dot}`} />
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-ink/50">
                      {s.label}
                    </span>
                  </span>
                  {!s.live && (
                    <span className="rounded-full border-theme border-ink/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/50">
                      Soon
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-display text-3xl font-black tracking-tight text-ink">
                    {s.label}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-ink/70">
                    {statFor(s)}
                  </p>
                </div>

                <span className={`mt-auto inline-flex w-fit items-center gap-2 font-display text-sm font-bold ${s.live ? accent.text : "text-ink/50"}`}>
                  {s.live ? "Enter" : "Preview"}
                  <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        {/* Community strip — calm ink band closing the page. */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-theme border-2 border-ink bg-ink p-7 text-white-smoke sm:p-8">
          <div>
            <p className="font-heading text-xl font-bold sm:text-2xl">
              The whole crew is in Discord.
            </p>
            <p className="mt-1 text-sm font-medium text-white-smoke/70">
              {onlineCount != null && onlineCount > 0
                ? `${onlineCount.toLocaleString()} members online right now — come hang.`
                : "Sports takes, what to watch, market moves, and the banter in between."}
            </p>
          </div>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="chip-tap tap-press inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-safety-orange px-6 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90"
          >
            <Bolt className="h-4 w-4" /> {discordLabel}
          </a>
        </div>
      </main>
    </AppShell>
  );
}
