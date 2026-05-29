import { getCurrentRate, getTotalOutstanding } from "@/lib/wb/interest";
import { listRecentDividends } from "@/lib/wb/dividend";
import { supabase } from "@/lib/supabase";
import {
  overrideRateAction,
  runAccrualAction,
  runPostAction,
  adjustmentAction,
  postDividendAction,
} from "./actions";

export const dynamic = "force-dynamic";

function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function loadRecentLedger() {
  const { data, error } = await supabase()
    .from("wb_ledger")
    .select("id, discord_user_id, amount_cents, kind, memo, created_at")
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) throw new Error(`recent ledger query failed: ${error.message}`);
  return data ?? [];
}

async function loadOpenAccruals() {
  const { data, error } = await supabase()
    .from("interest_accrual")
    .select("discord_user_id, amount_cents")
    .eq("posted", false);
  if (error) throw new Error(`accrual query failed: ${error.message}`);
  let users = 0;
  let totalCents = 0;
  const byUser = new Map<string, number>();
  for (const r of data ?? []) {
    byUser.set(r.discord_user_id, (byUser.get(r.discord_user_id) ?? 0) + Number(r.amount_cents));
    totalCents += Number(r.amount_cents);
  }
  users = byUser.size;
  return { users, totalCents };
}

export default async function AdminWbPage() {
  const [rate, outstandingCents, recent, accruals, dividends] = await Promise.all([
    getCurrentRate(),
    getTotalOutstanding(),
    loadRecentLedger(),
    loadOpenAccruals(),
    listRecentDividends(10).catch(() => []),
  ]);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const lastDayPrev = new Date(now);
  lastDayPrev.setUTCDate(0);
  const lastDayPrevStr = lastDayPrev.toISOString().slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
        Whoosh Bucks
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Virtual currency, ledger-backed. Balances reconcile from{" "}
        <code className="rounded bg-white-smoke px-1.5 py-0.5 text-xs">wb_ledger</code>.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Tile label="WB outstanding" value={formatMoney(outstandingCents)} />
        <Tile
          label="Current APY"
          value={rate ? `${(rate.apyBps / 100).toFixed(2)}%` : "—"}
          sub={rate ? `${rate.source} · since ${rate.effectiveDate}` : "no rate set"}
        />
        <Tile
          label="Unposted accruals"
          value={formatMoney(accruals.totalCents)}
          sub={`${accruals.users} ${accruals.users === 1 ? "user" : "users"}`}
        />
      </div>

      {/* Rate override */}
      <section className="mt-12 rounded-2xl border-2 border-ink bg-white-smoke p-6">
        <h2 className="font-heading text-xl font-bold">Override APY</h2>
        <p className="mt-1 text-sm text-ink/60">
          Sets today&rsquo;s rate. The daily cron will overwrite this tomorrow if
          a FRED rate is fetched successfully.
        </p>
        <form action={overrideRateAction} className="mt-4 flex flex-wrap items-stretch gap-3">
          <div className="relative">
            <input
              type="number"
              name="apy_pct"
              step="0.01"
              min="0"
              max="50"
              defaultValue={rate ? (rate.apyBps / 100).toFixed(2) : "2.00"}
              required
              className="w-28 rounded-full border-2 border-ink bg-white-smoke px-4 py-2 pr-8 font-heading font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink"
              aria-label="APY in percent"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-ink/60">
              %
            </span>
          </div>
          <button
            type="submit"
            className="tap-press cursor-pointer rounded-full border-2 border-ink bg-ink px-5 py-2 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
          >
            Set rate
          </button>
        </form>
      </section>

      {/* Cron triggers */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border-2 border-ink bg-white-smoke p-6">
          <h2 className="font-heading text-xl font-bold">Run accrual</h2>
          <p className="mt-1 text-sm text-ink/60">
            Manually accrue interest for a date. The daily cron does this
            automatically at 00:05 UTC for the previous day.
          </p>
          <form action={runAccrualAction} className="mt-4 flex flex-wrap items-stretch gap-3">
            <input
              type="date"
              name="date"
              defaultValue={yesterday}
              required
              className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-heading font-bold focus:outline-none focus:ring-2 focus:ring-ink"
            />
            <button
              type="submit"
              className="tap-press cursor-pointer rounded-full border-2 border-ink bg-ink px-5 py-2 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
            >
              Accrue
            </button>
          </form>
        </div>

        <div className="rounded-2xl border-2 border-ink bg-white-smoke p-6">
          <h2 className="font-heading text-xl font-bold">Post accruals</h2>
          <p className="mt-1 text-sm text-ink/60">
            Posts unposted accruals through this date as single ledger rows.
            The monthly cron does this on day 1 at 00:30 UTC.
          </p>
          <form action={runPostAction} className="mt-4 flex flex-wrap items-stretch gap-3">
            <input
              type="date"
              name="through"
              defaultValue={lastDayPrevStr}
              required
              className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-heading font-bold focus:outline-none focus:ring-2 focus:ring-ink"
            />
            <button
              type="submit"
              className="tap-press cursor-pointer rounded-full border-2 border-ink bg-ink px-5 py-2 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
            >
              Post
            </button>
          </form>
        </div>
      </section>

      {/* Manual adjustment */}
      <section className="mt-8 rounded-2xl border-2 border-ink bg-white-smoke p-6">
        <h2 className="font-heading text-xl font-bold">Manual adjustment</h2>
        <p className="mt-1 text-sm text-ink/60">
          Credit or debit a wallet. Positive USD = credit, negative = debit.
          Goes on the ledger as kind=<code>adjustment</code>.
        </p>
        <form action={adjustmentAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_120px_auto]">
          <input
            type="text"
            name="discord_user_id"
            placeholder="Discord user ID"
            required
            className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <input
            type="text"
            name="discord_username"
            placeholder="Username (for wallet row)"
            className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <input
            type="number"
            name="amount"
            placeholder="USD"
            step="0.01"
            required
            className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 text-right font-heading font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <button
            type="submit"
            className="tap-press cursor-pointer rounded-full border-2 border-ink bg-ink px-5 py-2 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
          >
            Apply
          </button>
          <input
            type="text"
            name="memo"
            placeholder="Memo (optional)"
            className="sm:col-span-4 rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </form>
      </section>

      {/* Dividends */}
      <section className="mt-8 rounded-2xl border-2 border-ink bg-white-smoke p-6">
        <h2 className="font-heading text-xl font-bold">Post a dividend</h2>
        <p className="mt-1 text-sm text-ink/60">
          Credits every holder of the symbol with{" "}
          <code className="rounded bg-ink/10 px-1">shares × dividend</code> at
          the 1 USD = 10 WB rate. Idempotent per (symbol, ex-date).
        </p>
        <form action={postDividendAction} className="mt-4 grid gap-3 sm:grid-cols-[160px_180px_180px_auto]">
          <input
            type="text"
            name="symbol"
            placeholder="Symbol"
            required
            autoComplete="off"
            className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-heading font-bold uppercase focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <input
            type="date"
            name="ex_date"
            required
            className="rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-heading font-bold focus:outline-none focus:ring-2 focus:ring-ink"
          />
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-heading font-bold text-ink/60">
              $
            </span>
            <input
              type="number"
              name="usd_per_share"
              step="0.0001"
              min="0.0001"
              placeholder="0.27"
              required
              inputMode="decimal"
              aria-label="USD dividend per share"
              className="w-full rounded-full border-2 border-ink bg-white-smoke px-3 py-2 pl-7 text-right font-heading font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>
          <button
            type="submit"
            className="tap-press cursor-pointer rounded-full border-2 border-ink bg-ink px-5 py-2 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
          >
            Post
          </button>
        </form>

        {dividends.length > 0 && (
          <ul className="mt-6 divide-y-2 divide-ink border-y-2 border-ink">
            {dividends.map((d) => (
              <li key={d.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 text-sm">
                <div>
                  <span className="font-heading font-black">{d.symbol}</span>{" "}
                  <span className="text-ink/60">· ex {d.exDate}</span>
                </div>
                <div className="text-right">
                  <div className="font-heading font-bold tabular-nums">
                    ${(d.wbCentsPerShare / 100).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}
                    /share
                  </div>
                  <div className="text-xs text-ink/60">{d.source}</div>
                </div>
                <div className="text-xs text-ink/60">
                  {d.usersCredited} credited
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent ledger */}
      <h2 className="mt-12 font-heading text-xl font-bold">Recent ledger activity</h2>
      {recent.length === 0 ? (
        <p className="mt-4 text-sm text-ink/60">No activity yet.</p>
      ) : (
        <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
          {recent.map((r) => {
            const cents = Number(r.amount_cents);
            const positive = cents >= 0;
            return (
              <li
                key={r.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 text-sm"
              >
                <div>
                  <div className="font-bold">{r.kind}</div>
                  <div className="text-xs text-ink/60">
                    {r.discord_user_id}
                    {r.memo ? ` · ${r.memo}` : ""}
                  </div>
                </div>
                <div
                  className={`font-heading text-lg font-black tabular-nums ${
                    positive ? "text-pigment-green" : "text-imperial-red"
                  }`}
                >
                  {positive ? "+" : ""}
                  {formatMoney(cents)}
                </div>
                <div className="text-xs text-ink/60">{formatDateTime(r.created_at)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-white-smoke p-5">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink/60">{label}</p>
      <p className="mt-3 font-heading text-3xl font-black tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink/50">{sub}</p>}
    </div>
  );
}
