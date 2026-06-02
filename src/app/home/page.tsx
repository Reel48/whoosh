import Link from "next/link";
import { requireSession } from "@/lib/membership";
import { AppShell } from "@/components/AppShell";
import { Bolt } from "@/components/Bolt";
import { SectionHero } from "@/components/ui/SectionHero";
import { ScoreTicker } from "@/components/news/ScoreTicker";
import { CapitalSnapshotCard } from "@/components/app/CapitalSnapshotCard";
import { Reveal } from "@/components/ui/Reveal";
import { SECTIONS, type Section } from "@/lib/sections";
import { getGuildOnlineCount, isGuildMember } from "@/lib/discord";
import { getLink } from "@/lib/fantasy/link";
import { getCrossLeagueScoreboard } from "@/lib/fantasy/rankings";
import { fetchFeed, DEFAULT_SPORT } from "@/lib/news/espn";
import { loadDashboard } from "@/lib/wb/dashboard";

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
 * Signed-in command center. The post-login dashboard: a vivid brand greeting
 * band, a live-scores ticker, a featured Capital equity snapshot, then
 * data-backed widgets for Fantasy and News, with Pool and the Discord call to
 * action filling out the grid. The body sits in a `data-theme="home"` scope so
 * it adopts the refined functional surface the sections share, while the hero
 * band stays loud and on-brand.
 */
export default async function Home() {
  const session = await requireSession("/home");

  const [onlineCount, inServer, link, board, topArticle, dashboard] = await Promise.all([
    getGuildOnlineCount().catch(() => null),
    session.discordUserId
      ? isGuildMember(session.discordUserId).catch(() => false)
      : Promise.resolve(false),
    getLink(session.id).catch(() => null),
    getCrossLeagueScoreboard().catch(() => ({ rows: [], leagues: [] })),
    fetchFeed(DEFAULT_SPORT)
      .then((a) => a[0] ?? null)
      .catch(() => null),
    loadDashboard(session.id).catch(() => null),
  ]);

  const discordLabel = inServer ? "Open the Discord" : "Join the Discord";

  // Fantasy snapshot for that section's card.
  const myRow = link ? board.rows.find((r) => r.ownerId === link.sleeperUserId) ?? null : null;
  const leader = board.rows[0] ?? null;

  /** The one live stat each section card carries under its tagline. */
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
    /* Live scores ticker pins right under the navbar (banner), the same slot
       the news section uses; the welcome card sits below it. */
    <AppShell banner={<ScoreTicker />}>
      <div data-theme="home">
        {/* Brand greeting band — a flat color block (no hatch), matching the
            calmer dashboard body below it. */}
        <div className="mx-auto w-full max-w-5xl px-6 pt-8 sm:pt-10">
          <SectionHero
            accent="sky"
            eyebrow="Welcome back"
            title={`@${session.username}`}
            avatarUrl={session.avatarUrl}
            username={session.username}
            hatch={false}
            aside={
              onlineCount != null && onlineCount > 0 ? (
                <span className="hidden items-center gap-2 rounded-full border-2 border-ink bg-white-smoke px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-ink sm:inline-flex">
                  <span className="inline-flex h-2 w-2 rounded-full border border-ink bg-pigment-green" />
                  {onlineCount.toLocaleString()} online
                </span>
              ) : undefined
            }
          />
        </div>

        <main className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-10">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Featured Capital equity snapshot, spanning the full width. Cards
                reveal in a short stagger as the dashboard arrives. */}
            <Reveal index={0} className="sm:col-span-2">
              <CapitalSnapshotCard data={dashboard} />
            </Reveal>

            <Reveal index={1} className="h-full">
              <SectionCard section={SECTIONS.fantasy} stat={statFor(SECTIONS.fantasy)} />
            </Reveal>
            <Reveal index={2} className="h-full">
              <SectionCard
                section={SECTIONS.news}
                stat={statFor(SECTIONS.news)}
                thumbnail={topArticle?.images?.[0] ?? null}
              />
            </Reveal>
            <Reveal index={3} className="h-full">
              <SectionCard section={SECTIONS.pool} stat={statFor(SECTIONS.pool)} />
            </Reveal>

            {/* Discord — one consolidated call to action. */}
            <Reveal index={4} className="h-full">
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full flex-col gap-4 rounded-theme border-theme border-ink/10 bg-ink p-7 text-white-smoke shadow-theme transition-transform hover:-translate-y-1"
            >
              <span className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full border-2 border-white-smoke bg-safety-orange" />
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-white-smoke/60">
                  Community
                </span>
              </span>
              <div>
                <h3 className="font-display text-2xl font-black tracking-tight">The crew is in Discord.</h3>
                <p className="mt-2 text-sm font-medium text-white-smoke/70">
                  {onlineCount != null && onlineCount > 0
                    ? `${onlineCount.toLocaleString()} online right now — come hang.`
                    : "Sports takes, market moves, and the banter in between."}
                </p>
              </div>
              <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-safety-orange px-4 py-2 font-display text-sm font-bold text-ink transition-opacity group-hover:opacity-90">
                <Bolt className="h-4 w-4" /> {discordLabel}
              </span>
            </a>
            </Reveal>
          </div>
        </main>
      </div>
    </AppShell>
  );
}

/**
 * A section entry on the hub: dot + label, big title, one live stat, and an
 * Enter/Preview affordance. News passes a thumbnail when its top story has one.
 */
function SectionCard({
  section: s,
  stat,
  thumbnail,
}: {
  section: Section;
  stat: string;
  thumbnail?: string | null;
}) {
  const accent = SECTION_ACCENT[s.key] ?? { dot: "bg-ink", text: "text-ink" };
  return (
    <Link
      href={s.href}
      data-theme={s.key}
      className="group flex h-full flex-col gap-4 rounded-theme border-theme border-ink/10 bg-white p-7 shadow-theme transition-transform hover:-translate-y-1"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2.5">
          <span className={`h-3 w-3 rounded-full border-2 border-ink ${accent.dot}`} />
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-ink/50">{s.label}</span>
        </span>
        {!s.live && (
          <span className="rounded-full border-theme border-ink/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/50">
            Soon
          </span>
        )}
      </div>

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-3xl font-black tracking-tight text-ink">{s.label}</h3>
          <p className="mt-2 line-clamp-2 text-sm font-medium text-ink/70">{stat}</p>
        </div>
        {thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element -- remote ESPN image
          <img
            src={thumbnail}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg border border-ink/10 object-cover"
          />
        )}
      </div>

      <span
        className={`mt-auto inline-flex w-fit items-center gap-2 font-display text-sm font-bold ${
          s.live ? accent.text : "text-ink/50"
        }`}
      >
        {s.live ? "Enter" : "Preview"}
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}
