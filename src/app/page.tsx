import Image from "next/image";
import { createCheckoutSession } from "./actions";
import { getSession } from "@/lib/session";
import { isGuildMember } from "@/lib/discord";
import { Nav } from "@/components/Nav";
import { Bolt } from "@/components/Bolt";

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

function Lock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </svg>
  );
}

const channelGroups = [
  { name: "Sports", accent: "text-real-blue", dot: "bg-real-blue", channels: ["NFL Football", "College Football", "Baseball", "Soccer", "Basketball", "Golf", "Fights"] },
  { name: "Media", accent: "text-bright-red", dot: "bg-bright-red", channels: ["Pic of the Day", "Movies & TV", "Music", "Gaming", "Videos"] },
  { name: "Miscellaneous", accent: "text-fresh-green", dot: "bg-fresh-green", channels: ["Health & Fitness", "Food & Drinks", "Counting Game", "Money Rankings", "Water the Tree"] },
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
  { q: "Is it really just guys?", a: "It started as one group chat with the guys. Everyone who's down for good takes and better banter is welcome." },
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-heading font-semibold uppercase tracking-[0.22em] text-real-blue">
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
    <div className="flex flex-1 flex-col bg-clear-white text-smooth-black">
      <Nav />

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2">
        <div>
          <SectionLabel>Sports · Entertainment · Business</SectionLabel>
          <h1 className="mt-5 font-heading text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            The only group chat you&rsquo;ll ever need.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-smooth-black/60">
            Whoosh is a premium group chat for the guys — sports takes, what to
            watch, market moves, and the banter in between. All in one Discord.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-real-blue px-7 py-3.5 text-base font-medium text-clear-white transition-colors hover:bg-smudged-blue">
              <Bolt className="h-5 w-5" /> {discordLabel}
            </a>
            <a href="#plans" className="inline-flex items-center justify-center rounded-full border border-smooth-black/20 px-7 py-3.5 text-base font-medium transition-colors hover:border-smooth-black/40">
              See the plans
            </a>
          </div>
        </div>

        {/* Hatch motif panel */}
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-smooth-black">
          <div className="hatch absolute inset-10 text-clear-white/15" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Bolt className="h-2/5 w-2/5 text-real-blue drop-shadow" />
          </div>
        </div>
      </section>

      {/* Channels */}
      <section id="channels" className="border-t border-smooth-black/10">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <SectionLabel>The lineup</SectionLabel>
          <h2 className="mt-4 max-w-2xl font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            Every channel worth opening.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-smooth-black/60">
            Dozens of channels across sports, media, and everything else — plus
            members-only Premium channels.
          </p>

          <div className="mt-14 divide-y divide-smooth-black/10 border-y border-smooth-black/10">
            {channelGroups.map((g) => (
              <div key={g.name} className="grid gap-5 py-8 lg:grid-cols-[1fr_3fr]">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${g.dot}`} />
                  <h3 className="font-heading text-xl font-semibold">{g.name}</h3>
                  <span className="text-sm text-smooth-black/40">{g.channels.length}</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {g.channels.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1.5 rounded-lg border border-smooth-black/15 px-3 py-1.5 text-sm">
                      <span className={`font-heading ${g.accent}`}>#</span>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Premium — members only */}
          <div className="mt-10 overflow-hidden rounded-3xl bg-smooth-black p-8 text-clear-white sm:p-10">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-matte-orange/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-matte-orange">
                <Lock className="h-3.5 w-3.5" /> Members only
              </span>
              <h3 className="font-heading text-2xl font-semibold">Premium channels</h3>
            </div>
            <p className="mt-3 max-w-xl text-clear-white/60">
              Unlocked the moment you subscribe.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {premiumChannels.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-lg border border-clear-white/15 bg-clear-white/5 px-3 py-1.5 text-sm">
                  <span className="font-heading text-matte-orange">#</span>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission band */}
      <section className="border-t border-smooth-black/10 bg-smooth-black text-clear-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-28 text-center">
          <Bolt className="mx-auto h-10 w-10 text-matte-orange" />
          <p className="mt-8 font-heading text-3xl font-medium leading-snug tracking-tight sm:text-4xl">
            &ldquo;The only group chat you&rsquo;ll ever need.&rdquo;
          </p>
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-blue-grey">Whoosh</p>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="border-t border-smooth-black/10">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* What's included */}
            <div>
              <SectionLabel>Membership</SectionLabel>
              <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
                One membership.<br />Everything unlocked.
              </h2>
              <p className="mt-4 max-w-md text-lg text-smooth-black/60">
                Whoosh Premium opens every members-only channel and perk. Pick
                the billing that suits you — cancel anytime.
              </p>
              <ul className="mt-8 space-y-4">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Bolt className="mt-1 h-4 w-4 shrink-0 text-real-blue" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Billing options */}
            <div className="space-y-4">
              {/* Discord connection status — shown above the Subscribe options */}
              {session ? (
                <div className="flex items-center gap-3 rounded-2xl border border-fresh-green/40 bg-fresh-green/5 px-4 py-3 text-sm">
                  <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-fresh-green" />
                  <span className="flex-1">
                    Connected as{" "}
                    <strong className="font-heading font-semibold">@{session.username}</strong>
                  </span>
                  <form action="/api/auth/discord/logout" method="POST">
                    <button
                      type="submit"
                      className="cursor-pointer text-smooth-black/50 underline-offset-2 hover:text-smooth-black hover:underline"
                    >
                      Disconnect
                    </button>
                  </form>
                </div>
              ) : (
                <a
                  href="/api/auth/discord"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-smooth-black/20 bg-smooth-black/[0.03] px-4 py-3 text-sm transition-colors hover:border-smooth-black/40"
                >
                  <span>
                    <strong className="font-heading font-semibold">Connect your Discord</strong>{" "}
                    so we can grant your Premium role on payment.
                  </span>
                  <span className="shrink-0 rounded-full bg-smooth-black px-3 py-1 text-xs font-medium text-clear-white">
                    Connect →
                  </span>
                </a>
              )}
              {inServer ? (
                <p className="text-xs text-smooth-black/50">
                  <span className="text-fresh-green">✓</span> You&rsquo;re in
                  the Whoosh server — your Premium role will land as soon as
                  payment clears.
                </p>
              ) : (
                <p className="text-xs text-smooth-black/50">
                  Make sure you&rsquo;ve already{" "}
                  <a
                    href={DISCORD_INVITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-real-blue underline-offset-2 hover:underline"
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
                  className={`flex items-center justify-between gap-4 rounded-2xl border p-6 ${
                    b.highlight ? "border-real-blue bg-real-blue/5" : "border-smooth-black/15"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-heading text-lg font-semibold">{b.name}</h3>
                      {b.badge && (
                        <span className="rounded-full bg-real-blue px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-clear-white">
                          {b.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-heading text-3xl font-bold">{b.price}</span>
                      <span className="text-smooth-black/50">{b.per}</span>
                    </div>
                    <p className="mt-1 text-sm text-smooth-black/50">{b.note}</p>
                  </div>
                  <form action={createCheckoutSession}>
                    <input type="hidden" name="interval" value={b.interval} />
                    <button
                      type="submit"
                      className={`shrink-0 cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                        b.highlight
                          ? "bg-real-blue text-clear-white hover:bg-smudged-blue"
                          : "border border-smooth-black/20 hover:border-smooth-black/40"
                      }`}
                    >
                      Subscribe
                    </button>
                  </form>
                </div>
              ))}
              <p className="pt-2 text-sm text-smooth-black/50">
                Secure payments via Stripe. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-smooth-black/10">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1fr_2fr]">
          <div>
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight sm:text-5xl">Good questions.</h2>
          </div>
          <div className="divide-y divide-smooth-black/10 border-y border-smooth-black/10">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-heading text-lg font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="ml-4 text-2xl text-real-blue transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-smooth-black/60">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t border-smooth-black/10 bg-smooth-black text-clear-white">
        <div className="relative mx-auto w-full max-w-6xl overflow-hidden px-6 py-24 text-center">
          <div className="hatch pointer-events-none absolute inset-0 text-clear-white/10" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl font-heading text-4xl font-bold tracking-tight sm:text-5xl">
              Stop scrolling five different apps.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-clear-white/60">
              One chat for everything you actually care about. Come hang.
            </p>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-real-blue px-8 py-4 text-base font-medium text-clear-white transition-colors hover:bg-smudged-blue">
              <Bolt className="h-5 w-5" /> {discordLabel}
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-smooth-black text-blue-grey">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
          <Image src="/whoosh-wordmark-white.svg" alt="Whoosh" width={1440} height={368} className="h-6 w-auto" />
          <div className="flex items-center gap-6 text-sm">
            <a href="#channels" className="hover:text-clear-white">Channels</a>
            <a href="#plans" className="hover:text-clear-white">Plans</a>
            <a href="#faq" className="hover:text-clear-white">FAQ</a>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="hover:text-clear-white">Discord</a>
          </div>
          <p className="text-sm text-blue-grey/60">&copy; {new Date().getFullYear()} Whoosh</p>
        </div>
      </footer>
    </div>
  );
}
