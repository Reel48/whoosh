import Image from "next/image";
import { Bolt } from "@/components/Bolt";
import { listPoolOffers, formatUsd, BUNDLE_OFFER, type PoolOffer } from "@/lib/fantasy/poolEntry";
import { startPoolCheckoutAction } from "./actions";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "1",
    title: "Pick your pool",
    body: "Survivor, Pick 'Em, or both. One flat entry fee for the whole season — no subscription.",
  },
  {
    n: "2",
    title: "Pay with card",
    body: "Secure checkout through Stripe. All we need is an email for your receipt.",
  },
  {
    n: "3",
    title: "Get your invite",
    body: "Your Sleeper invite link appears the second payment clears. Tap it, claim your spot, start picking.",
  },
];

function OfferCard({ offer, featured }: { offer: PoolOffer; featured: boolean }) {
  return (
    <div
      className={`flex flex-col rounded-3xl border-2 border-ink p-7 sm:p-8 ${
        featured ? "bg-lime" : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-2xl font-black tracking-tight sm:text-3xl">
          {offer.name}
        </h3>
        {featured && offer.strikeCents !== null && (
          <span className="shrink-0 rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-lime">
            Best value
          </span>
        )}
      </div>

      <p className="mt-4 flex-1 text-base font-medium leading-relaxed text-ink/75">
        {offer.blurb}
      </p>

      <div className="mt-7 flex items-baseline gap-2.5">
        <span className="font-heading text-5xl font-black tracking-tight">
          {formatUsd(offer.priceCents)}
        </span>
        {offer.strikeCents !== null && (
          <span className="text-lg font-bold text-ink/40 line-through">
            {formatUsd(offer.strikeCents)}
          </span>
        )}
        <span className="text-sm font-bold uppercase tracking-[0.15em] text-ink/50">
          / season
        </span>
      </div>

      <form action={startPoolCheckoutAction} className="mt-6">
        <input type="hidden" name="offer" value={offer.id} />
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-7 py-3.5 text-base font-bold text-white-smoke transition-opacity hover:opacity-90"
        >
          <Bolt className="h-5 w-5" /> Join for {formatUsd(offer.priceCents)}
        </button>
      </form>
    </div>
  );
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [offers, { error }] = await Promise.all([
    listPoolOffers().catch(() => [] as PoolOffer[]),
    searchParams,
  ]);
  const season = offers[0]?.season ?? "2026";
  // Bundle last and visually featured; the single-pool cards keep DB order.
  const singles = offers.filter((o) => o.id !== BUNDLE_OFFER);
  const bundle = offers.find((o) => o.id === BUNDLE_OFFER) ?? null;

  return (
    <>
      {/* Bare header — the wordmark is a mark, not a link. Nothing here
          navigates off this page except Stripe. */}
      <header className="border-b-2 border-ink bg-white-smoke">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Image
            src="/whoosh-wordmark-ink.svg"
            alt="Whoosh"
            width={1440}
            height={368}
            className="h-6 w-auto"
            priority
          />
          <span className="font-heading text-xs font-bold uppercase tracking-[0.22em] text-ink/60">
            NFL {season}
          </span>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b-2 border-ink bg-blue">
          <div className="mx-auto w-full max-w-5xl px-6 py-16 text-center sm:py-24">
            <span className="font-heading text-xs font-bold uppercase tracking-[0.22em] text-ink">
              Survivor · Pick &rsquo;Em
            </span>
            <h1 className="mx-auto mt-5 max-w-3xl font-heading text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              Two pools. One season. Bragging rights on the line.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg font-medium leading-relaxed text-ink/80">
              Pay your entry, get your Sleeper invite instantly, and play the {season}{" "}
              NFL season with the Whoosh crew. No account to create.
            </p>
          </div>
        </section>

        {/* Offers */}
        <section className="border-b-2 border-ink bg-white-smoke">
          <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
            {error && (
              <div
                role="alert"
                className="mb-8 rounded-2xl border-2 border-ink bg-safety-orange px-5 py-4 text-base font-bold"
              >
                Something went wrong starting checkout. Give it another shot.
              </div>
            )}

            {offers.length === 0 ? (
              <div className="rounded-3xl border-2 border-ink bg-white p-8 text-center">
                <p className="font-heading text-2xl font-black tracking-tight">
                  Entries aren&rsquo;t open yet.
                </p>
                <p className="mt-3 text-base font-medium text-ink/70">
                  Check back shortly — the {season} pools open before Week 1.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2">
                  {singles.map((o) => (
                    <OfferCard key={o.id} offer={o} featured={false} />
                  ))}
                </div>
                {bundle && (
                  <div className="mt-6">
                    <OfferCard offer={bundle} featured />
                  </div>
                )}
              </>
            )}

            <p className="mt-8 text-center text-sm font-medium text-ink/60">
              Entry fees are one-time and cover the full {season}{" "}
              season. You&rsquo;ll need a free Sleeper account to make your picks.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-white-smoke">
          <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
            <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
              How it works
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-3xl border-2 border-ink bg-white p-6">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-lime font-heading text-lg font-black">
                    {s.n}
                  </span>
                  <h3 className="mt-4 font-heading text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-base font-medium leading-relaxed text-ink/70">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-ink bg-white-smoke">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm font-medium text-ink/60">
          <span>© {new Date().getFullYear()} Whoosh</span>
          <span>Pools are hosted and played on Sleeper.</span>
        </div>
      </footer>
    </>
  );
}
