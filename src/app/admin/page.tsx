import Link from "next/link";
import { getAdminStats } from "@/lib/stripe";
import { getWbTotalSupply, getDau, getSupplySeries } from "@/lib/wb/admin";
import { SupplyChart } from "@/components/admin/SupplyChart";

export const dynamic = "force-dynamic";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(unix: number) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminDashboardPage() {
  let stats;
  let error: string | null = null;
  try {
    stats = await getAdminStats();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load stats";
  }

  const [supplyCents, dau, dau7, supplySeries] = await Promise.all([
    getWbTotalSupply().catch(() => 0),
    getDau(1).catch(() => 0),
    getDau(7).catch(() => 0),
    getSupplySeries(90).catch(() => []),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
        Dashboard
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Live snapshot from Stripe.
      </p>
      <p className="mt-2 rounded-xl border-2 border-ink bg-mango px-3 py-2 text-xs font-bold text-ink sm:hidden">
        Admin tools are built for desktop — some tables read better on a larger screen.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border-2 border-ink bg-ink px-4 py-3 text-sm font-medium text-white-smoke">
          Failed to load stats: {error}
        </div>
      )}

      {stats && (
        <>
          {/* Headline metric tiles */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Active subscribers"
              value={stats.totalActive.toLocaleString()}
              tone="good"
            />
            <Tile
              label="Estimated MRR"
              value={formatMoney(stats.estimatedMrrCents)}
              sub="normalized monthly across active subs"
            />
            <Tile
              label="Past due"
              value={stats.totalPastDue.toLocaleString()}
              tone={stats.totalPastDue > 0 ? "warn" : "neutral"}
            />
            <Tile
              label="Canceled (lifetime)"
              value={stats.totalCanceled.toLocaleString()}
            />
          </div>

          {/* WB economy tiles */}
          <h2 className="mt-12 font-heading text-xl font-bold">WB economy</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total WB outstanding" value={formatMoney(supplyCents)} />
            <Tile label="DAU (24h)" value={dau.toLocaleString()} />
            <Tile label="WAU (7d)" value={dau7.toLocaleString()} />
            <Tile
              label="Ledger entries"
              value={supplySeries.length > 0 ? "Live" : "—"}
              sub="cron-driven"
            />
          </div>

          {/* Supply chart */}
          {supplySeries.length > 0 && (
            <div className="mt-6 rounded-2xl border-2 border-ink bg-white-smoke p-5">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink/60">
                Total WB supply · last 90 days
              </p>
              <div className="mt-2 overflow-x-auto">
                <SupplyChart data={supplySeries} />
              </div>
            </div>
          )}

          {/* Plan breakdown */}
          <h2 className="mt-12 font-heading text-xl font-bold">By plan</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Tile label="Monthly · $4/mo" value={stats.byPlan.monthly.toLocaleString()} />
            <Tile label="6 Months · $20" value={stats.byPlan.sixMonths.toLocaleString()} />
            <Tile label="Annual · $36/yr" value={stats.byPlan.annual.toLocaleString()} />
          </div>

          {/* Recent activity */}
          <div className="mt-12 flex items-baseline justify-between">
            <h2 className="font-heading text-xl font-bold">Most recent</h2>
            <Link
              href="/admin/subscribers"
              className="text-sm font-medium text-ink/70 underline-offset-2 hover:underline"
            >
              See all subscribers →
            </Link>
          </div>
          {stats.recentSubs.length === 0 ? (
            <p className="mt-4 text-sm text-ink/60">No subscriptions yet.</p>
          ) : (
            <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
              {stats.recentSubs.map((s) => (
                <li
                  key={s.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {s.discordUsername ? `@${s.discordUsername}` : "(unknown)"}
                    </div>
                    <div className="text-xs text-ink/60">
                      {s.discordUserId ?? s.customerId}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-heading font-bold">{s.planLabel}</div>
                    <div className="text-xs text-ink/60">{formatDate(s.createdAt)}</div>
                  </div>
                  <StatusPill status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function Tile({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const accent =
    tone === "good"
      ? "bg-pigment-green text-ink"
      : tone === "warn"
        ? "bg-ink text-white-smoke"
        : "bg-white-smoke text-ink";
  return (
    <div className="rounded-2xl border-2 border-ink bg-white-smoke p-5">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink/60">
        {label}
      </p>
      <p className="mt-3 font-heading text-3xl font-black tracking-tight">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink/50">{sub}</p>}
      {tone !== "neutral" && (
        <span
          className={`mt-3 inline-block rounded-full border-2 border-ink px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${accent}`}
        >
          {tone === "good" ? "Healthy" : "Attention"}
        </span>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-pigment-green text-ink" },
    trialing: { label: "Trialing", cls: "bg-pigment-green text-ink" },
    past_due: { label: "Past due", cls: "bg-ink text-white-smoke" },
    unpaid: { label: "Unpaid", cls: "bg-ink text-white-smoke" },
    canceled: { label: "Canceled", cls: "bg-white-smoke text-ink" },
    incomplete: { label: "Incomplete", cls: "bg-white-smoke text-ink" },
    incomplete_expired: { label: "Expired", cls: "bg-white-smoke text-ink" },
    paused: { label: "Paused", cls: "bg-white-smoke text-ink" },
  };
  const m = map[status] ?? { label: status, cls: "bg-white-smoke text-ink" };
  return (
    <span
      className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
