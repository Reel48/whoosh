import Image from "next/image";

function Bolt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M168 28 L84 150 l44 4 -40 74 L172 122 l-44 -4 Z" />
    </svg>
  );
}

const tiers = [
  {
    name: "Splash",
    price: "$5",
    blurb: "Dip your toes in.",
    perks: ["Access to premium channels", "Member-only events", "Whoosh role"],
    highlight: false,
  },
  {
    name: "Current",
    price: "$12",
    blurb: "Ride the wave with the core crew.",
    perks: [
      "Everything in Splash",
      "Priority support",
      "Exclusive drops & giveaways",
      "Voice lounges",
    ],
    highlight: true,
  },
  {
    name: "Riptide",
    price: "$25",
    blurb: "All in. The full Whoosh.",
    perks: [
      "Everything in Current",
      "1:1 channel access",
      "Early feature access",
      "Founding member badge",
    ],
    highlight: false,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Nav */}
      <header className="bg-blue-surf text-white">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <Image
            src="/whoosh-wordmark-white.svg"
            alt="Whoosh"
            width={1440}
            height={368}
            className="h-7 w-auto"
            priority
          />
          <div className="flex items-center gap-6 text-sm font-heading font-semibold tracking-wide">
            <a href="#mission" className="hidden hover:opacity-80 sm:inline">
              Mission
            </a>
            <a href="#plans" className="hidden hover:opacity-80 sm:inline">
              Plans
            </a>
            <a
              href="#"
              className="rounded-full bg-yellow-sun px-4 py-2 text-nautilus transition-opacity hover:opacity-90"
            >
              Join the Discord
            </a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-blue-surf text-white">
        <Bolt className="pointer-events-none absolute -right-10 top-1/2 hidden h-[120%] w-auto -translate-y-1/2 text-white/5 sm:block" />
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-24 text-center sm:py-32">
          <Image
            src="/whoosh-wordmark-white.svg"
            alt="Whoosh"
            width={1440}
            height={368}
            className="w-full max-w-2xl"
            priority
          />
          <p className="mt-10 max-w-xl text-2xl leading-snug text-kiddie-pool sm:text-3xl">
            The only group chat you&rsquo;ll ever need.
          </p>
          <p className="mt-4 max-w-lg text-lg text-white/70">
            Premium Discord communities, powered by Whoosh. Subscribe to unlock
            members-only channels, events, and perks.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-yellow-sun px-7 py-3 text-base font-heading font-bold text-nautilus transition-opacity hover:opacity-90"
            >
              <Bolt className="h-5 w-5" />
              Join the Discord
            </a>
            <a
              href="#plans"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3 text-base font-heading font-semibold text-white transition-colors hover:bg-white/10"
            >
              View plans
            </a>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section
        id="mission"
        className="relative overflow-hidden bg-kiddie-pool text-blue-surf"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 select-none font-body text-[18rem] leading-none text-blue-surf/10"
        >
          &ldquo;
        </span>
        <div className="relative mx-auto w-full max-w-4xl px-6 py-28 text-center">
          <p className="font-body text-4xl leading-tight text-nautilus sm:text-5xl">
            The only group chat you&rsquo;ll ever need.
          </p>
          <p className="mt-8 text-sm font-heading font-semibold tracking-[0.4em] text-blue-surf">
            WHOOSH
          </p>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="text-center">
            <h2 className="text-4xl font-heading font-extrabold text-nautilus sm:text-5xl">
              Pick your tier
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-surf">
              Subscribe through Whoosh and your premium Discord access is granted
              automatically.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`flex flex-col rounded-3xl border p-8 ${
                  tier.highlight
                    ? "border-blue-surf bg-blue-surf text-white shadow-xl"
                    : "border-kiddie-pool bg-white text-nautilus"
                }`}
              >
                <h3 className="text-2xl font-heading font-bold">{tier.name}</h3>
                <p
                  className={`mt-1 text-sm ${
                    tier.highlight ? "text-kiddie-pool" : "text-blue-surf"
                  }`}
                >
                  {tier.blurb}
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-heading font-extrabold">
                    {tier.price}
                  </span>
                  <span
                    className={
                      tier.highlight ? "text-kiddie-pool" : "text-blue-surf"
                    }
                  >
                    /mo
                  </span>
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Bolt
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          tier.highlight ? "text-yellow-sun" : "text-blue-surf"
                        }`}
                      />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#"
                  className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-heading font-bold transition-opacity hover:opacity-90 ${
                    tier.highlight
                      ? "bg-yellow-sun text-nautilus"
                      : "bg-blue-surf text-white"
                  }`}
                >
                  Subscribe
                </a>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-blue-surf/70">
            Payments coming soon via Stripe.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-nautilus text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
          <Image
            src="/whoosh-wordmark-white.svg"
            alt="Whoosh"
            width={1440}
            height={368}
            className="h-6 w-auto"
          />
          <div className="flex items-center gap-6 text-sm text-kiddie-pool">
            <a href="#mission" className="hover:text-white">
              Mission
            </a>
            <a href="#plans" className="hover:text-white">
              Plans
            </a>
            <a href="#" className="hover:text-white">
              Discord
            </a>
          </div>
          <p className="text-sm text-kiddie-pool/60">
            &copy; {new Date().getFullYear()} Whoosh
          </p>
        </div>
      </footer>
    </div>
  );
}
