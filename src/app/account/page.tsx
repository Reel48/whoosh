import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPremiumRole, addPremiumRole } from "@/lib/discord";
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

  const [initialRoleGranted, sub] = await Promise.all([
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

  // Self-healing: if the user has an active Stripe subscription but the
  // Discord role isn't granted (webhook missed, user just joined the server,
  // bot was down at the time, etc.), attempt to grant it on this page visit.
  // The Discord API call is idempotent — granting an already-granted role is
  // a 204 no-op.
  let roleGranted = initialRoleGranted;
  if (isActive && !initialRoleGranted) {
    try {
      const r = await addPremiumRole(session.id);
      if (r.ok) {
        roleGranted = true;
        // Note: we deliberately don't invalidate the unstable_cache here.
        // The local roleGranted=true reflects reality in this render; the
        // cache will catch up within ~5 minutes, and the self-heal is
        // idempotent so any redundant call before then is harmless.
        console.log(
          JSON.stringify({
            at: "account.self_heal.granted",
            discord_user_id: session.id,
            subscription_id: sub?.id,
          }),
        );
      } else {
        console.warn(
          JSON.stringify({
            at: "account.self_heal.failed",
            discord_user_id: session.id,
            subscription_id: sub?.id,
            status: r.status,
            body: r.body,
          }),
        );
      }
    } catch (e) {
      console.error("Self-heal exception:", e);
    }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <span className="text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink">
          Your account
        </span>

        {/* Identity card — BLUE block */}
        <div className="mt-6 flex items-center gap-4 rounded-3xl border-2 border-ink bg-blue p-6 text-ink">
          <Avatar
            id={session.id}
            hash={session.avatar}
            username={session.username}
            size={64}
            className="border-2 border-ink"
          />
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-black tracking-tight">
              @{session.username}
            </h1>
            <p className="mt-1 text-sm font-medium text-ink/80">
              Signed in with Discord
            </p>
          </div>
          <form action="/api/auth/discord/logout" method="POST">
            <button
              type="submit"
              className="cursor-pointer rounded-full border-2 border-ink bg-white-smoke px-4 py-2 text-sm font-bold transition-colors hover:bg-ink hover:text-white-smoke"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Premium status card — neutral so colored status pills can live inside */}
        <div className="mt-6 rounded-3xl border-2 border-ink bg-white-smoke p-6 text-ink sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-xl font-bold">Whoosh Premium</h2>
            <StatusPill status={sub?.status} />
            {isActive && sub?.cancelAtPeriodEnd && (
              <span className="rounded-full border-2 border-ink bg-imperial-red px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white-smoke">
                Ends {renewalDate}
              </span>
            )}
          </div>

          {sub ? (
            <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Field label="Plan">{sub.planLabel}</Field>
              <Field label="Price">{formatMoney(sub.amount, sub.currency)}</Field>
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
                    <span className="inline-flex h-2.5 w-2.5 rounded-full border-2 border-ink bg-pigment-green" />
                    Granted
                  </span>
                ) : isActive ? (
                  <span className="inline-flex items-center gap-1.5 font-bold text-imperial-red">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full border-2 border-ink bg-imperial-red" />
                    Not granted yet
                  </span>
                ) : (
                  <span className="text-ink/60">Not granted</span>
                )}
              </Field>
            </dl>
          ) : (
            <p className="mt-4 font-medium text-ink/80">
              You don&rsquo;t have an active subscription. Pick a plan to unlock
              the Premium channels.
            </p>
          )}

          {isActive && !roleGranted && (
            <p className="mt-6 rounded-xl border-2 border-ink bg-imperial-red px-4 py-3 text-sm font-medium text-white-smoke">
              We can&rsquo;t see the Premium role on your Discord account yet.
              Make sure you&rsquo;ve{" "}
              <a
                href="https://discord.gg/zzP8nFFzQt"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline"
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
                  className="cursor-pointer rounded-full border-2 border-ink bg-ink px-6 py-3 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
                >
                  Manage subscription
                </button>
              </form>
            ) : (
              <a
                href="/#plans"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-6 py-3 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
              >
                <Bolt className="h-4 w-4" /> See the plans
              </a>
            )}
            <a
              href="https://discord.gg/zzP8nFFzQt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border-2 border-ink bg-white-smoke px-6 py-3 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-white-smoke"
            >
              Open Discord
            </a>
          </div>
        </div>

        <p className="mt-6 text-xs font-medium text-ink/60">
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
      <dt className="text-xs font-bold uppercase tracking-wider text-ink/60">{label}</dt>
      <dd className="mt-1 font-heading font-bold">{children}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string | undefined }) {
  if (!status) {
    return (
      <span className="rounded-full border-2 border-ink bg-white-smoke px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-ink">
        Inactive
      </span>
    );
  }
  const label = STATUS_LABEL[status] ?? status;
  const isGood = status === "active" || status === "trialing";
  const isWarn = status === "past_due" || status === "unpaid";
  const cls = isGood
    ? "bg-pigment-green text-white-smoke"
    : isWarn
      ? "bg-imperial-red text-white-smoke"
      : "bg-white-smoke text-ink";
  return (
    <span
      className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}
