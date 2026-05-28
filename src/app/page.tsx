import Image from "next/image";
import { createCheckoutSession } from "./actions";

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

/* ---------- Brand bits ---------- */

function Bolt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 375 375" className={className} aria-hidden="true" fill="currentColor">
      <path d="M 212.199219 168.605469 L 269.113281 163.523438 C 269.796875 163.464844 270.253906 164.054688 269.84375 164.480469 C 227.035156 208.949219 179.03125 255.128906 125.265625 302.070312 C 96.945312 326.792969 68.757812 350.226562 40.90625 372.402344 C 40.285156 372.894531 39.234375 372.339844 39.617188 371.71875 C 58.9375 340.503906 79.519531 308.625 101.457031 276.179688 C 118.152344 251.484375 134.945312 227.484375 151.757812 204.175781 C 152.0625 203.75 151.621094 203.242188 150.996094 203.289062 C 130.617188 204.820312 110.238281 206.351562 89.859375 207.878906 C 89.167969 207.933594 88.726562 207.320312 89.160156 206.90625 C 123.707031 173.6875 161.773438 139.226562 203.628906 104.078125 C 247.824219 66.964844 291.429688 33.128906 333.578125 2.390625 C 334.234375 1.910156 335.246094 2.542969 334.792969 3.144531 C 293.671875 57.996094 252.550781 112.851562 211.429688 167.707031 C 211.105469 168.136719 211.558594 168.664062 212.199219 168.605469 Z M 212.199219 168.605469 " />
    </svg>
  );
}

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
  { q: "How do I get in?", a: "Pick a plan, subscribe, and your premium Discord access is granted automatically. (Payments are coming soon via Stripe.)" },
  { q: "Can I cancel anytime?", a: "Yes. Manage or cancel your subscription whenever you like — no awkward DMs required." },
  { q: "Is it really just guys?", a: "It started as one group chat with the guys. Everyone who's down for good takes and better banter is welcome." },
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-heading font-semibold uppercase tracking-[0.22em] text-real-blue">
    {children}
  </span>
);

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-clear-white text-smooth-black">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-smooth-black/10 bg-clear-white/90 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Image src="/whoosh-wordmark-asphalt.svg" alt="Whoosh" width={1440} height={368} className="h-6 w-auto" priority />
          <div className="flex items-center gap-7 text-sm font-medium">
            <a href="#channels" className="hidden hover:text-real-blue sm:inline">Channels</a>
            <a href="#plans" className="hidden hover:text-real-blue sm:inline">Plans</a>
            <a href="#faq" className="hidden hover:text-real-blue sm:inline">FAQ</a>
            <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-real-blue px-4 py-2 text-clear-white transition-colors hover:bg-smudged-blue">
              <Bolt className="h-4 w-4" /> Join the Discord
            </a>
          </div>
        </nav>
      </header>

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
              <Bolt className="h-5 w-5" /> Join the Discord
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
                Payments coming soon via Stripe. Cancel anytime.
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
              <Bolt className="h-5 w-5" /> Join the Discord
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
