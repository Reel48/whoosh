import Image from "next/image";
import { createCheckoutSession } from "./actions";
import { getSession } from "@/lib/session";
import { isGuildMember, getGuildOnlineCount } from "@/lib/discord";
import {
  getLeaderboard,
  getTradersLeaderboard,
  getBiggestWinsLeaderboard,
  getStreaksLeaderboard,
} from "@/lib/wb/leaderboard";
import { Nav } from "@/components/Nav";
import { Bolt } from "@/components/Bolt";
import { LeaderboardTabs } from "@/components/wb/LeaderboardTabs";

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

function Lock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  );
}

function PercentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  );
}

function DiceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="21" y1="3" x2="10" y2="14" />
      <polygon points="21 3 14 21 10 14 3 10 21 3" />
    </svg>
  );
}

const bucksCards = [
  {
    title: "Earn",
    badge: "SPAXX-tied",
    body: "Idle WB earn a daily yield tracking the SPAXX 7-day rate. Posted to your wallet every month, no lock-up.",
    href: "/wallet",
    cta: "Open wallet",
    cardClass: "bg-pigment-green text-ink",
    iconClass: "text-ink",
    ctaClass: "bg-ink text-white-smoke",
    Icon: PercentIcon,
  },
  {
    title: "Invest",
    badge: "Real US equities",
    body: "Buy fractional shares of any US-listed stock at live market prices. Track your P/L right alongside your cash.",
    href: "/invest",
    cta: "Open trade desk",
    cardClass: "bg-blue text-ink",
    iconClass: "text-ink",
    ctaClass: "bg-ink text-white-smoke",
    Icon: TrendUpIcon,
  },
  {
    title: "Wager",
    badge: "House events",
    body: "Bet on Whoosh-curated events at fixed odds. Stake locked at placement, paid out on settlement.",
    href: "/events",
    cta: "See open events",
    cardClass: "bg-imperial-red text-ink",
    iconClass: "text-ink",
    ctaClass: "bg-ink text-white-smoke",
    Icon: DiceIcon,
  },
  {
    title: "Send",
    badge: "Member to member",
    body: "Transfer WB to any Whoosh member by Discord username. Instant, no fees, fully reversible only via a return transfer.",
    href: "/wallet",
    cta: "Send WB",
    cardClass: "bg-lavender text-ink",
    iconClass: "text-ink",
    ctaClass: "bg-ink text-white-smoke",
    Icon: SendIcon,
  },
];

const channelGroups = [
  { name: "Sports", accent: "text-blue", dot: "bg-blue", channels: ["NFL Football", "College Football", "Baseball", "Soccer", "Basketball", "Golf", "Fights"] },
  { name: "Media", accent: "text-imperial-red", dot: "bg-imperial-red", channels: ["Pic of the Day", "Movies & TV", "Music", "Gaming", "Videos"] },
  { name: "Miscellaneous", accent: "text-pigment-green", dot: "bg-pigment-green", channels: ["Health & Fitness", "Food & Drinks", "Counting Game", "Money Rankings", "Water the Tree"] },
];

const premiumChannels = ["Premium Wheel Spin", "Sports News", "Sports Betting", "Business", "Politics"];

const included = [
  "Every Premium channel — Wheel Spin, Sports News, Sports Betting, Business & Politics",
  "Full run of the chat — all sports, media & misc channels",
  "Members-only events, drops & giveaways",
  "The Whoosh Premium role",
];

const billing = [
  { name: "Monthly", interval: "monthly", price: "$4", per: "/month", note: "Billed every month", highlight: false },
  { name: "6 Months", interval: "six_months", price: "$20", per: "/6 months", note: "$3.33/mo · save 17%", highlight: false },
  { name: "Annual", interval: "annual", price: "$36", per: "/year", note: "$3/mo · save 25%", highlight: true, badge: "Best value" },
];

const faqs = [
  { q: "What is Whoosh?", a: "A premium, invite-worthy group chat that lives in Discord — covering sports, entertainment, business, and whatever else the crew is into that day." },
  { q: "How do I get in?", a: "Pick a plan, sign in with Discord, and pay through Stripe. Your Premium role lands in the server automatically — usually within seconds." },
  { q: "Can I cancel anytime?", a: "Yes. Manage or cancel your subscription whenever you like — no awkward DMs required." },
  { q: "Who is Whoosh for?", a: "Anyone who wants smart, fast takes on sports, entertainment, business, and culture. If you'd want to be in the group chat, you're in the right place." },
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink">
    {children}
  </span>
);

export default async function Home() {
  const session = await getSession();
  const [inServer, onlineCount, holders, traders, wins, streaks] = await Promise.all([
    session ? isGuildMember(session.id).catch(() => false) : Promise.resolve(false),
    getGuildOnlineCount(),
    getLeaderboard(10).catch(() => []),
    getTradersLeaderboard(10, 7).catch(() => []),
    getBiggestWinsLeaderboard(10, 7).catch(() => []),
    getStreaksLeaderboard(10).catch(() => []),
  ]);
  const discordLabel = inServer ? "Open Discord" : "Join the Discord";

  return (
    <div className="flex flex-1 flex-col bg-white-smoke text-ink">
      <Nav />

      {/* Hero — BLUE block */}
      <section className="border-b-2 border-ink bg-blue">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2">
          <div>
            <SectionLabel>Sports · Entertainment · Business</SectionLabel>
            <h1 className="mt-5 font-heading text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              The only group chat you&rsquo;ll ever need.
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium leading-relaxed text-ink/80">
              Whoosh is a premium group chat — sports takes, what to watch,
              market moves, and the banter in between. All in one Discord.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-7 py-3.5 text-base font-bold text-white-smoke transition-opacity hover:opacity-90"
              >
                <Bolt className="h-5 w-5" /> {discordLabel}
              </a>
              <a
                href="#plans"
                className="inline-flex items-center justify-center rounded-full border-2 border-ink bg-white-smoke px-7 py-3.5 text-base font-bold text-ink transition-colors hover:bg-ink hover:text-white-smoke"
              >
                See the plans
              </a>
            </div>
          </div>

          {/* Hatch motif panel — LIME with ink stripes + ink bolt */}
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl border-2 border-ink bg-blue">
            <div className="hatch absolute inset-10 text-ink/30" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Bolt className="h-2/5 w-2/5 text-ink" />
            </div>
          </div>
        </div>
      </section>

      {/* Channels — WHITE SMOKE canvas */}
      <section id="channels" className="border-b-2 border-ink bg-white-smoke">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <SectionLabel>The lineup</SectionLabel>
          <h2 className="mt-4 max-w-2xl font-heading text-4xl font-black tracking-tight sm:text-5xl">
            Every channel worth opening.
          </h2>
          <p className="mt-4 max-w-xl text-lg font-medium text-ink/70">
            Dozens of channels across sports, media, and everything else — plus
            members-only Premium channels.
          </p>

          <div className="mt-14 divide-y-2 divide-ink border-y-2 border-ink">
            {channelGroups.map((g) => (
              <div key={g.name} className="grid gap-5 py-8 lg:grid-cols-[1fr_3fr]">
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full border-2 border-ink ${g.dot}`} />
                  <h3 className="font-heading text-xl font-bold">{g.name}</h3>
                  <span className="text-sm text-ink/50">{g.channels.length}</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {g.channels.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-white-smoke px-3 py-1.5 text-sm font-medium"
                    >
                      <span className={`font-heading font-black ${g.accent}`}>#</span>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Premium — full-bleed SAFETY ORANGE card. Same orange + ink
              language as the Membership section, so the two read as a pair. */}
          <div className="mt-10 overflow-hidden rounded-3xl border-2 border-ink bg-safety-orange p-8 text-ink sm:p-10">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-safety-orange">
                <Lock className="h-3.5 w-3.5" /> Members only
              </span>
              <h3 className="font-heading text-2xl font-bold">Premium channels</h3>
            </div>
            <p className="mt-3 max-w-xl font-medium text-ink/80">
              Unlocked the moment you subscribe.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {premiumChannels.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-safety-orange px-3 py-1.5 text-sm font-medium"
                >
                  <span className="font-heading font-black text-ink">#</span>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission band — PIGMENT GREEN */}
      <section className="border-b-2 border-ink bg-pigment-green">
        <div className="mx-auto w-full max-w-5xl px-6 py-28 text-center">
          <Bolt className="mx-auto h-10 w-10 text-ink" />
          <p className="mt-8 font-heading text-3xl font-black leading-snug tracking-tight text-ink sm:text-4xl">
            &ldquo;The only group chat you&rsquo;ll ever need.&rdquo;
          </p>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-ink">Whoosh</p>
          {onlineCount != null && onlineCount > 0 && (
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-ink/70">
              <span className="inline-flex h-2 w-2 rounded-full border-2 border-ink bg-ink" />
              {onlineCount.toLocaleString()} members online now
            </p>
          )}
        </div>
      </section>

      {/* Plans — SAFETY ORANGE block (orange = the new "premium" color).
          One section color + ink, white-smoke cards. */}
      <section id="plans" className="border-b-2 border-ink bg-safety-orange">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* What's included */}
            <div className="text-ink">
              <SectionLabel>Membership</SectionLabel>
              <h2 className="mt-4 font-heading text-4xl font-black tracking-tight sm:text-5xl">
                One membership.<br />Everything unlocked.
              </h2>
              <p className="mt-4 max-w-md text-lg font-medium text-ink/80">
                Whoosh Premium opens every members-only channel and perk. Pick
                the billing that suits you — cancel anytime.
              </p>
              <ul className="mt-8 space-y-4">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Bolt className="mt-1 h-4 w-4 shrink-0 text-ink" />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Billing options */}
            <div className="space-y-4">
              {/* Discord connection banner — ink CTA when signed out, neutral confirmation when signed in */}
              {session ? (
                <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white-smoke px-4 py-3 text-sm text-ink">
                  <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink bg-ink" />
                  <span className="flex-1 font-medium">
                    Connected as{" "}
                    <strong className="font-heading font-bold">@{session.username}</strong>
                  </span>
                  <form action="/api/auth/discord/logout" method="POST">
                    <button
                      type="submit"
                      className="cursor-pointer text-ink/70 underline-offset-2 hover:text-ink hover:underline"
                    >
                      Disconnect
                    </button>
                  </form>
                </div>
              ) : (
                <a
                  href="/api/auth/discord"
                  className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-ink px-4 py-3 text-sm text-white-smoke transition-opacity hover:opacity-90"
                >
                  <span className="font-medium">
                    <strong className="font-heading font-bold">Connect your Discord</strong>{" "}
                    so we can grant your Premium role on payment.
                  </span>
                  <span className="shrink-0 rounded-full border-2 border-ink bg-safety-orange px-3 py-1 text-xs font-bold text-ink">
                    Connect →
                  </span>
                </a>
              )}
              {inServer ? (
                <p className="text-xs font-medium text-ink/70">
                  <span className="font-black">✓</span> You&rsquo;re in the
                  Whoosh server — your Premium role will land as soon as
                  payment clears.
                </p>
              ) : (
                <p className="text-xs font-medium text-ink/70">
                  Make sure you&rsquo;ve already{" "}
                  <a
                    href={DISCORD_INVITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-ink underline underline-offset-2"
                  >
                    joined the Whoosh server
                  </a>{" "}
                  — the Premium role is granted to your account inside the
                  server.
                </p>
              )}

              {billing.map((b) => {
                const isHi = b.highlight;
                return (
                  <div
                    key={b.name}
                    className={`flex items-center justify-between gap-4 rounded-2xl border-2 border-ink p-6 ${
                      isHi ? "bg-ink text-white-smoke" : "bg-white-smoke text-ink"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-heading text-lg font-bold">{b.name}</h3>
                        {b.badge && (
                          <span className="rounded-full border-2 border-ink bg-safety-orange px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-ink">
                            {b.badge}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="font-heading text-3xl font-black">{b.price}</span>
                        <span className={`font-medium ${isHi ? "text-white-smoke/70" : "text-ink/70"}`}>
                          {b.per}
                        </span>
                      </div>
                      <p className={`mt-1 text-sm font-medium ${isHi ? "text-white-smoke/70" : "text-ink/70"}`}>
                        {b.note}
                      </p>
                    </div>
                    <form action={createCheckoutSession}>
                      <input type="hidden" name="interval" value={b.interval} />
                      <button
                        type="submit"
                        className={`shrink-0 cursor-pointer rounded-full border-2 border-ink px-5 py-2.5 text-sm font-bold transition-opacity hover:opacity-90 ${
                          isHi ? "bg-safety-orange text-ink" : "bg-ink text-white-smoke"
                        }`}
                      >
                        Subscribe
                      </button>
                    </form>
                  </div>
                );
              })}
              <p className="pt-2 text-sm font-medium text-ink/70">
                Secure payments via Stripe. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Whoosh Bucks — WHITE SMOKE canvas, four colored cards. Sits between
          the orange Plans block and the lime FAQ to keep the alternating
          colored / neutral rhythm of the page. */}
      <section id="bucks" className="border-b-2 border-ink bg-white-smoke">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <SectionLabel>Whoosh Bucks</SectionLabel>
          <div className="mt-4 grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-end">
            <h2 className="max-w-2xl font-heading text-4xl font-black tracking-tight sm:text-5xl">
              The chat&rsquo;s own currency. Earn it, invest it, bet it, send it.
            </h2>
            <p className="text-lg font-medium text-ink/70 lg:text-right">
              Every $1 paid via Stripe = $10 of Whoosh Bucks. Premium
              members get a matching credit on every renewal.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {bucksCards.map((c) => {
              const Icon = c.Icon;
              return (
                <a
                  key={c.title}
                  href={c.href}
                  className={`group flex flex-col gap-5 rounded-3xl border-2 border-ink p-7 transition-opacity hover:opacity-95 ${c.cardClass}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Icon className={`h-10 w-10 ${c.iconClass}`} />
                    <span className="rounded-full border-2 border-ink bg-white-smoke px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-ink">
                      {c.badge}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-heading text-3xl font-black tracking-tight">
                      {c.title}
                    </h3>
                    <p className="mt-2 max-w-sm text-base font-medium opacity-90">
                      {c.body}
                    </p>
                  </div>
                  <span
                    className={`mt-auto inline-flex w-fit items-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-sm font-bold ${c.ctaClass}`}
                  >
                    {c.cta}
                    <span aria-hidden="true">→</span>
                  </span>
                </a>
              );
            })}
          </div>

          <div className="mt-10">
            <LeaderboardTabs
              holders={holders}
              traders={traders}
              wins={wins}
              streaks={streaks}
              highlightUserId={session?.id ?? null}
            />
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-ink bg-ink p-7 text-white-smoke sm:p-8">
            <div>
              <p className="font-heading text-xl font-bold sm:text-2xl">
                Your portfolio, all in one place.
              </p>
              <p className="mt-1 text-sm font-medium text-white-smoke/70">
                Balance, allocation, lifetime returns, 90-day chart — every dollar accounted for.
              </p>
            </div>
            <a
              href="/wallet"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-safety-orange px-6 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90"
            >
              <Bolt className="h-4 w-4" /> Open your wallet
            </a>
          </div>
        </div>
      </section>

      {/* FAQ — LIME block */}
      <section id="faq" className="border-b-2 border-ink bg-lime">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1fr_2fr]">
          <div>
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="mt-4 font-heading text-4xl font-black tracking-tight sm:text-5xl">
              Good questions.
            </h2>
          </div>
          <div className="divide-y-2 divide-ink border-y-2 border-ink">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-heading text-lg font-bold [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <span
                    aria-hidden="true"
                    className="ml-4 text-2xl font-black text-ink transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl font-medium text-ink/80">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA band — LAVENDER (purple) */}
      <section className="border-b-2 border-ink bg-lavender">
        <div className="relative mx-auto w-full max-w-6xl overflow-hidden px-6 py-24 text-center">
          <div className="hatch pointer-events-none absolute inset-0 text-ink/15" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl font-heading text-4xl font-black tracking-tight text-ink sm:text-5xl">
              Stop scrolling five different apps.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg font-medium text-ink/80">
              One chat for everything you actually care about. Come hang.
            </p>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-9 inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-8 py-4 text-base font-bold text-white-smoke transition-opacity hover:opacity-90"
            >
              <Bolt className="h-5 w-5" /> {discordLabel}
            </a>
          </div>
        </div>
      </section>

      {/* Footer — INK */}
      <footer className="mt-auto bg-ink text-white-smoke">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
          <Image src="/whoosh-wordmark-white.svg" alt="Whoosh" width={1440} height={368} className="h-6 w-auto" />
          <div className="flex items-center gap-6 text-sm font-medium">
            <a href="#channels" className="hover:underline">Channels</a>
            <a href="#bucks" className="hover:underline">Whoosh Bucks</a>
            <a href="#plans" className="hover:underline">Plans</a>
            <a href="#faq" className="hover:underline">FAQ</a>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="hover:underline">Discord</a>
          </div>
          <p className="text-sm text-white-smoke/60">&copy; {new Date().getFullYear()} Whoosh</p>
        </div>
      </footer>
    </div>
  );
}
