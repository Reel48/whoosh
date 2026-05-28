import Image from "next/image";
import { createCheckoutSession } from "./actions";
import { getSession } from "@/lib/session";
import { isGuildMember } from "@/lib/discord";
import { Nav } from "@/components/Nav";
import { Bolt } from "@/components/Bolt";

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

function Lock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  );
}

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
  { name: "Monthly", interval: "monthly", price: "$4", per: "/month", note: "Billed every month", bg: "bg-cream", highlight: false },
  { name: "6 Months", interval: "six_months", price: "$20", per: "/6 months", note: "$3.33/mo · save 17%", bg: "bg-lavender", highlight: false },
  { name: "Annual", interval: "annual", price: "$36", per: "/year", note: "$3/mo · save 25%", bg: "bg-mango", highlight: true, badge: "Best value" },
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
  const inServer = session
    ? await isGuildMember(session.id).catch(() => false)
    : false;
  const discordLabel = inServer ? "Open Discord" : "Join the Discord";

  return (
    <div className="flex flex-1 flex-col bg-white-smoke text-ink">
      <Nav />

      {/* Hero — BLUE block */}
      <section className="border-b-2 border-ink bg-blue">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2">
          <div>
            <SectionLabel>Sports · Entertainment · Business</SectionLabel>
            <h1 className="mt-5 font-heading text-5xl font-black leading-[1.0] tracking-tight sm:text-6xl lg:text-7xl">
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
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-7 py-3.5 text-base font-bold text-white-smoke transition-colors hover:bg-imperial-red"
              >
                <Bolt className="h-5 w-5" /> {discordLabel}
              </a>
              <a
                href="#plans"
                className="inline-flex items-center justify-center rounded-full border-2 border-ink bg-white-smoke px-7 py-3.5 text-base font-bold text-ink transition-colors hover:bg-mango"
              >
                See the plans
              </a>
            </div>
          </div>

          {/* Hatch motif panel — LIME with ink stripes + ink bolt */}
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl border-2 border-ink bg-lime">
            <div className="hatch absolute inset-10 text-ink/25" />
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

          {/* Premium — full-bleed MANGO card with ink everything */}
          <div className="mt-10 overflow-hidden rounded-3xl border-2 border-ink bg-mango p-8 text-ink sm:p-10">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-mango">
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
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-mango px-3 py-1.5 text-sm font-medium"
                >
                  <span className="font-heading font-black text-imperial-red">#</span>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission band — SAFETY ORANGE */}
      <section className="border-b-2 border-ink bg-safety-orange">
        <div className="mx-auto w-full max-w-5xl px-6 py-28 text-center">
          <Bolt className="mx-auto h-10 w-10 text-ink" />
          <p className="mt-8 font-heading text-3xl font-black leading-snug tracking-tight text-ink sm:text-4xl">
            &ldquo;The only group chat you&rsquo;ll ever need.&rdquo;
          </p>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.3em] text-ink">Whoosh</p>
        </div>
      </section>

      {/* Plans — WHITE SMOKE canvas with colored billing cards */}
      <section id="plans" className="border-b-2 border-ink bg-white-smoke">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* What's included */}
            <div>
              <SectionLabel>Membership</SectionLabel>
              <h2 className="mt-4 font-heading text-4xl font-black tracking-tight sm:text-5xl">
                One membership.<br />Everything unlocked.
              </h2>
              <p className="mt-4 max-w-md text-lg font-medium text-ink/70">
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
              {/* Discord connection banner */}
              {session ? (
                <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-pigment-green px-4 py-3 text-sm text-ink">
                  <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink bg-white-smoke" />
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
                  className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-lavender px-4 py-3 text-sm text-ink transition-colors hover:bg-plum"
                >
                  <span className="font-medium">
                    <strong className="font-heading font-bold">Connect your Discord</strong>{" "}
                    so we can grant your Premium role on payment.
                  </span>
                  <span className="shrink-0 rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-bold text-white-smoke">
                    Connect →
                  </span>
                </a>
              )}
              {inServer ? (
                <p className="text-xs font-medium text-ink/70">
                  <span className="font-bold text-pigment-green">✓</span> You&rsquo;re in
                  the Whoosh server — your Premium role will land as soon as
                  payment clears.
                </p>
              ) : (
                <p className="text-xs font-medium text-ink/70">
                  Make sure you&rsquo;ve already{" "}
                  <a
                    href={DISCORD_INVITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-imperial-red underline-offset-2 hover:underline"
                  >
                    joined the Whoosh server
                  </a>{" "}
                  — the Premium role is granted to your account inside the
                  server.
                </p>
              )}

              {billing.map((b) => (
                <div
                  key={b.name}
                  className={`flex items-center justify-between gap-4 rounded-2xl border-2 border-ink p-6 text-ink ${b.bg}`}
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-heading text-lg font-bold">{b.name}</h3>
                      {b.badge && (
                        <span className="rounded-full border-2 border-ink bg-imperial-red px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white-smoke">
                          {b.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-heading text-3xl font-black">{b.price}</span>
                      <span className="font-medium text-ink/70">{b.per}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-ink/70">{b.note}</p>
                  </div>
                  <form action={createCheckoutSession}>
                    <input type="hidden" name="interval" value={b.interval} />
                    <button
                      type="submit"
                      className="shrink-0 cursor-pointer rounded-full border-2 border-ink bg-ink px-5 py-2.5 text-sm font-bold text-white-smoke transition-colors hover:bg-imperial-red"
                    >
                      Subscribe
                    </button>
                  </form>
                </div>
              ))}
              <p className="pt-2 text-sm font-medium text-ink/60">
                Secure payments via Stripe. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — PLUM block */}
      <section id="faq" className="border-b-2 border-ink bg-plum">
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
                  {f.q}
                  <span className="ml-4 text-2xl font-black text-ink transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl font-medium text-ink/80">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA band — LIME */}
      <section className="border-b-2 border-ink bg-lime">
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
              className="mt-9 inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-8 py-4 text-base font-bold text-white-smoke transition-colors hover:bg-blue"
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
            <a href="#channels" className="hover:text-lime">Channels</a>
            <a href="#plans" className="hover:text-lime">Plans</a>
            <a href="#faq" className="hover:text-lime">FAQ</a>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="hover:text-lime">Discord</a>
          </div>
          <p className="text-sm text-white-smoke/60">&copy; {new Date().getFullYear()} Whoosh</p>
        </div>
      </footer>
    </div>
  );
}
