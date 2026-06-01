import Link from "next/link";
import { listSubscriptions, type SubscriptionListItem } from "@/lib/stripe";
import type Stripe from "stripe";
import { reconcileWbAction } from "./actions";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: string; label: string; statuses: Stripe.Subscription.Status[] | null }> = [
  { key: "active", label: "Active", statuses: ["active", "trialing"] },
  { key: "attention", label: "Past due", statuses: ["past_due", "unpaid"] },
  { key: "canceled", label: "Canceled", statuses: ["canceled"] },
  { key: "all", label: "All", statuses: null },
];

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(unix: number) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}

type SearchParams = Promise<{ filter?: string; reconciled?: string; scanned?: string }>;

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filterKey = params.filter ?? "active";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const reconciled = params.reconciled;

  let subs: SubscriptionListItem[] = [];
  let error: string | null = null;
  try {
    subs = await listSubscriptions({
      statuses: filter.statuses ?? undefined,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load subscribers";
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            Subscribers
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            {subs.length.toLocaleString()} {subs.length === 1 ? "subscription" : "subscriptions"} ·{" "}
            {filter.label.toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/subscribers${f.key === "active" ? "" : `?filter=${f.key}`}`}
              className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                f.key === filterKey
                  ? "bg-ink text-white-smoke"
                  : "bg-white-smoke text-ink hover:bg-ink hover:text-white-smoke"
              }`}
            >
              {f.label}
            </Link>
          ))}
          <form action={reconcileWbAction}>
            <button
              type="submit"
              title="Credit any missed Stripe → Whoosh Bucks (premium, purchases, fantasy). Idempotent."
              className="rounded-full border-2 border-ink bg-pigment-green px-3 py-1 text-xs font-bold uppercase tracking-wider text-white-smoke hover:opacity-90"
            >
              Reconcile WB
            </button>
          </form>
        </div>
      </div>

      {reconciled !== undefined && (
        <div className="mt-6 rounded-xl border-2 border-ink bg-white-smoke px-4 py-3 text-sm font-medium">
          {reconciled === "err"
            ? "Reconcile failed — check server logs."
            : `Reconcile complete — ${reconciled} new credit${reconciled === "1" ? "" : "s"} applied${
                params.scanned ? ` (${params.scanned} paid objects scanned)` : ""
              }.`}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border-2 border-ink bg-imperial-red px-4 py-3 text-sm font-medium text-white-smoke">
          {error}
        </div>
      )}

      <div className="mt-8 overflow-x-auto rounded-2xl border-2 border-ink">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-ink text-white-smoke">
            <tr>
              <Th>Member</Th>
              <Th>Plan</Th>
              <Th>Price</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
              <Th>Next renewal</Th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-ink bg-white-smoke">
            {subs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/60">
                  No subscriptions in this filter.
                </td>
              </tr>
            ) : (
              subs.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <div className="font-medium">
                      {s.username ? `@${s.username}` : "(unknown)"}
                    </div>
                    {s.appEmail && (
                      <div className="text-[11px] text-ink/70">{s.appEmail}</div>
                    )}
                    {s.customerEmail && s.customerEmail !== s.appEmail && (
                      <div className="text-[11px] text-ink/40">
                        Stripe: {s.customerEmail}
                      </div>
                    )}
                    {s.discordUserId && (
                      <div className="font-mono text-[10px] text-ink/40">
                        Discord {s.discordUserId}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <span className="font-heading font-bold">{s.planLabel}</span>
                  </Td>
                  <Td>{formatMoney(s.amount, s.currency)}</Td>
                  <Td>
                    <StatusPill status={s.status} />
                    {s.cancelAtPeriodEnd && (
                      <div className="mt-1 text-[11px] font-medium text-ink/60">
                        Ends {formatDate(s.currentPeriodEnd)}
                      </div>
                    )}
                  </Td>
                  <Td>{formatDate(s.createdAt)}</Td>
                  <Td>{formatDate(s.currentPeriodEnd)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-ink/50">
        Showing up to 100 most recent subscriptions per Stripe response. Click a
        filter above to narrow.
      </p>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-pigment-green text-white-smoke" },
    trialing: { label: "Trialing", cls: "bg-pigment-green text-white-smoke" },
    past_due: { label: "Past due", cls: "bg-imperial-red text-white-smoke" },
    unpaid: { label: "Unpaid", cls: "bg-imperial-red text-white-smoke" },
    canceled: { label: "Canceled", cls: "bg-white-smoke text-ink" },
    incomplete: { label: "Incomplete", cls: "bg-white-smoke text-ink" },
    incomplete_expired: { label: "Expired", cls: "bg-white-smoke text-ink" },
    paused: { label: "Paused", cls: "bg-white-smoke text-ink" },
  };
  const m = map[status] ?? { label: status, cls: "bg-white-smoke text-ink" };
  return (
    <span
      className={`inline-flex rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
