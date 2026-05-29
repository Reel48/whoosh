import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Bolt } from "@/components/Bolt";
import { getSession } from "@/lib/session";
import { hasPremiumRole, addPremiumRole } from "@/lib/discord";
import { ensureWallet, getBalance } from "@/lib/wb/ledger";
import { formatWb } from "@/lib/wb/format";

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "You're in — Whoosh",
};

export default async function Thanks() {
  const session = await getSession();
  let balance: number | null = null;
  let roleGranted = false;

  if (session) {
    await ensureWallet(session.id, session.username);
    const [bal, hasRole] = await Promise.all([
      getBalance(session.id).catch(() => 0),
      hasPremiumRole(session.id).catch(() => false),
    ]);
    balance = bal;
    roleGranted = hasRole;
    // Best-effort self-heal — webhook may not have landed yet.
    if (!hasRole) {
      try {
        const r = await addPremiumRole(session.id);
        roleGranted = r.ok;
      } catch {
        // ignored — /account will retry on next visit
      }
    }
  }

  return (
    <>
      <Nav />
      <main className="flex flex-1 flex-col items-center bg-lime px-6 py-16 text-center text-ink sm:py-24">
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
          Welcome to Whoosh Premium. Three things to do next 👇
        </p>

        {session ? (
          <div className="mt-10 w-full max-w-2xl space-y-4 text-left">
            <Step
              n={1}
              title="Open Discord"
              body={
                roleGranted
                  ? "Your Premium role is granted. The members-only channels should be visible now."
                  : "Your Premium role is being granted in the background. Open Discord — if you don't see the members-only channels in 30 seconds, refresh /account."
              }
              ctaLabel="Open Discord"
              ctaHref={DISCORD_INVITE}
              external
              tone={roleGranted ? "good" : "warn"}
            />
            <Step
              n={2}
              title="Claim your starter Whoosh Bucks"
              body={
                balance != null && balance > 0
                  ? `You've got ${formatWb(balance)} WB waiting in your wallet — Premium match credited to your account.`
                  : "Your Premium match WB will land in your wallet shortly. Stripe webhook → ledger usually takes a few seconds."
              }
              ctaLabel="Open wallet"
              ctaHref="/capital/wallet"
              tone="good"
            />
            <Step
              n={3}
              title="Try the trade desk"
              body="Buy a fractional share of any US-listed stock or crypto with your Whoosh Bucks. Paper trading — no real money — but the prices are live."
              ctaLabel="Open trade desk"
              ctaHref="/capital/invest"
              tone="neutral"
            />
          </div>
        ) : (
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-9 inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-7 py-3.5 text-base font-bold text-white-smoke transition-opacity hover:opacity-90"
          >
            <Bolt className="h-5 w-5" /> Open Discord
          </a>
        )}

        <Link
          href="/account"
          className="mt-8 text-sm font-bold text-ink underline underline-offset-4 hover:no-underline"
        >
          View your account
        </Link>
      </main>
    </>
  );
}

function Step({
  n,
  title,
  body,
  ctaLabel,
  ctaHref,
  external = false,
  tone = "neutral",
}: {
  n: number;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  external?: boolean;
  tone?: "good" | "warn" | "neutral";
}) {
  const numberBg =
    tone === "good"
      ? "bg-pigment-green text-white-smoke"
      : tone === "warn"
        ? "bg-imperial-red text-white-smoke"
        : "bg-ink text-white-smoke";
  const Cta = external ? "a" : Link;
  const ctaProps = external
    ? { href: ctaHref, target: "_blank" as const, rel: "noopener noreferrer" as const }
    : { href: ctaHref };
  return (
    <div className="rounded-3xl border-2 border-ink bg-white-smoke p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink font-heading text-lg font-black ${numberBg}`}
        >
          {n}
        </div>
        <div className="flex-1">
          <h3 className="font-heading text-xl font-bold text-ink">{title}</h3>
          <p className="mt-1 text-sm font-medium text-ink/70">{body}</p>
        </div>
      </div>
      <div className="mt-4 sm:ml-14">
        <Cta
          {...ctaProps}
          className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-5 py-2.5 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
        >
          {ctaLabel} <span aria-hidden="true">→</span>
        </Cta>
      </div>
    </div>
  );
}
