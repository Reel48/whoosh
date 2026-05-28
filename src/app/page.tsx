import Image from "next/image";

function Bolt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 375 375"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M 212.199219 168.605469 L 269.113281 163.523438 C 269.796875 163.464844 270.253906 164.054688 269.84375 164.480469 C 227.035156 208.949219 179.03125 255.128906 125.265625 302.070312 C 96.945312 326.792969 68.757812 350.226562 40.90625 372.402344 C 40.285156 372.894531 39.234375 372.339844 39.617188 371.71875 C 58.9375 340.503906 79.519531 308.625 101.457031 276.179688 C 118.152344 251.484375 134.945312 227.484375 151.757812 204.175781 C 152.0625 203.75 151.621094 203.242188 150.996094 203.289062 C 130.617188 204.820312 110.238281 206.351562 89.859375 207.878906 C 89.167969 207.933594 88.726562 207.320312 89.160156 206.90625 C 123.707031 173.6875 161.773438 139.226562 203.628906 104.078125 C 247.824219 66.964844 291.429688 33.128906 333.578125 2.390625 C 334.234375 1.910156 335.246094 2.542969 334.792969 3.144531 C 293.671875 57.996094 252.550781 112.851562 211.429688 167.707031 C 211.105469 168.136719 211.558594 168.664062 212.199219 168.605469 Z M 212.199219 168.605469 " />
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
