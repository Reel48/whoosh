import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPremiumRole } from "@/lib/discord";
import { findSubscriptionForDiscordUser } from "@/lib/stripe";
import { Nav } from "@/components/Nav";
import { Avatar } from "@/components/Avatar";
import { Bolt } from "@/components/Bolt";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account — Whoosh",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Incomplete",
  paused: "Paused",
  canceled: "Canceled",
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(unix: number) {
  if (!unix) return null;
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    redirect("/api/auth/discord?next=/account");
  }

  // Run the two lookups in parallel — Discord role membership + Stripe subscription.
  const [roleGranted, sub] = await Promise.all([
    hasPremiumRole(session.id).catch((e) => {
      console.error("Premium role lookup failed:", e);
      return false;
    }),
    findSubscriptionForDiscordUser(session.id).catch((e) => {
      console.error("Stripe subscription lookup failed:", e);
      return null;
    }),
  ]);

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const renewalDate = sub ? formatDate(sub.currentPeriodEnd) : null;

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <span className="text-xs font-heading font-semibold uppercase tracking-[0.22em] text-real-blue">
          Your account
        </span>

        {/* Identity card */}
        <div className="mt-6 flex items-center gap-4 rounded-3xl border border-smooth-black/10 p-6">
          <Avatar
            id={session.id}
            hash={session.avatar}
            username={session.username}
            size={64}
          />
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              @{session.username}
            </h1>
            <p className="mt-1 text-sm text-smooth-black/60">
              Signed in with Discord
            </p>
          </div>
          <form action="/api/auth/discord/logout" method="POST">
            <button
              type="submit"
              className="cursor-pointer rounded-full border border-smooth-black/15 px-4 py-2 text-sm font-medium transition-colors hover:border-smooth-black/40"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Premium status card */}
        <div className="mt-6 rounded-3xl border border-smooth-black/10 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-xl font-semibold">Whoosh Premium</h2>
            <StatusPill status={sub?.status} />
            {isActive && sub?.cancelAtPeriodEnd && (
              <span className="rounded-full bg-bright-red/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-bright-red">
                Ends {renewalDate}
              </span>
            )}
          </div>

          {sub ? (
            <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Field label="Plan">{sub.planLabel}</Field>
              <Field label="Price">
                {formatMoney(sub.amount, sub.currency)}
              </Field>
              {renewalDate && (
                <Field
                  label={
                    sub.cancelAtPeriodEnd
                      ? "Access until"
                      : isActive
                        ? "Next renewal"
                        : "Period ended"
                  }
                >
                  {renewalDate}
                </Field>
              )}
              <Field label="Discord role">
                {roleGranted ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-2 w-2 rounded-full bg-fresh-green" />
                    Granted
                  </span>
                ) : isActive ? (
                  <span className="inline-flex items-center gap-1.5 text-bright-red">
                    <span className="inline-flex h-2 w-2 rounded-full bg-bright-red" />
                    Not granted yet
                  </span>
                ) : (
                  <span className="text-smooth-black/60">Not granted</span>
                )}
              </Field>
            </dl>
          ) : (
            <p className="mt-4 text-smooth-black/60">
              You don&rsquo;t have an active subscription. Pick a plan to unlock
              the Premium channels.
            </p>
          )}

          {/* Hint when there's a role/sub mismatch */}
          {isActive && !roleGranted && (
            <p className="mt-6 rounded-xl bg-bright-red/5 px-4 py-3 text-sm text-bright-red">
              We can&rsquo;t see the Premium role on your Discord account yet.
              Make sure you&rsquo;ve{" "}
              <a
                href="https://discord.gg/zzP8nFFzQt"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                joined the Whoosh server
              </a>{" "}
              — the role is granted to existing members. If you just joined,
              refresh this page in a moment.
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {sub ? (
              <form action="/api/portal" method="POST">
                <button
                  type="submit"
                  className="cursor-pointer rounded-full bg-real-blue px-6 py-3 text-sm font-medium text-clear-white transition-colors hover:bg-smudged-blue"
                >
                  Manage subscription
                </button>
              </form>
            ) : (
              <a
                href="/#plans"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-real-blue px-6 py-3 text-sm font-medium text-clear-white transition-colors hover:bg-smudged-blue"
              >
                <Bolt className="h-4 w-4" /> See the plans
              </a>
            )}
            <a
              href="https://discord.gg/zzP8nFFzQt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-smooth-black/20 px-6 py-3 text-sm font-medium transition-colors hover:border-smooth-black/40"
            >
              Open Discord
            </a>
          </div>
        </div>

        <p className="mt-6 text-xs text-smooth-black/50">
          Billing and cancellation are handled by Stripe&rsquo;s secure customer
          portal. Roles in Discord are managed by Whoosh automatically based on
          your subscription status.
        </p>
      </main>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-smooth-black/50">{label}</dt>
      <dd className="mt-1 font-heading font-semibold">{children}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string | undefined }) {
  if (!status) {
    return (
      <span className="rounded-full bg-smooth-black/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-smooth-black/60">
        Inactive
      </span>
    );
  }
  const label = STATUS_LABEL[status] ?? status;
  const isGood = status === "active" || status === "trialing";
  const isWarn = status === "past_due" || status === "unpaid";
  const cls = isGood
    ? "bg-fresh-green/10 text-fresh-green"
    : isWarn
      ? "bg-bright-red/10 text-bright-red"
      : "bg-smooth-black/10 text-smooth-black/60";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}
