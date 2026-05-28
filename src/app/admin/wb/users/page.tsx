import Link from "next/link";
import { findRecipient } from "@/lib/wb/transfer";
import { getBalance, getRecentLedger, type LedgerKind } from "@/lib/wb/ledger";
import { loadDashboard } from "@/lib/wb/dashboard";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import { adjustWbAction } from "./actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<LedgerKind, string> = {
  purchase: "Purchase",
  premium_match: "Premium match",
  interest: "Interest",
  transfer_in: "Received",
  transfer_out: "Sent",
  bet_stake: "Bet placed",
  bet_payout: "Bet payout",
  invest_buy: "Buy",
  invest_sell: "Sell",
  adjustment: "Adjustment",
};

function fmtMoney(cents: number, opts: { signed?: boolean } = {}): string {
  const sign = cents < 0 ? "-" : opts.signed && cents > 0 ? "+" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function getMemberSince(userId: string): Promise<string | null> {
  const { data, error } = await supabase()
    .from("wallet")
    .select("created_at")
    .eq("discord_user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.created_at;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const lookupRaw = (sp.user ?? "").trim();
  const recipient = lookupRaw ? await findRecipient(lookupRaw) : null;

  const [balance, ledger, dashboard, memberSince] = recipient
    ? await Promise.all([
        getBalance(recipient.discordUserId),
        getRecentLedger(recipient.discordUserId, 15),
        loadDashboard(recipient.discordUserId),
        getMemberSince(recipient.discordUserId),
      ])
    : [0, [], null, null];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
        Users
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Look up a wallet by Discord username and credit or debit Whoosh Bucks.
      </p>

      {/* Search */}
      <form action="/admin/wb/users" method="GET" className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-bold text-ink/60">
            @
          </span>
          <input
            type="text"
            name="user"
            defaultValue={lookupRaw}
            placeholder="discord_username"
            required
            autoComplete="off"
            className="w-full rounded-full border-2 border-ink bg-white-smoke px-4 py-3 pl-8 font-heading font-bold focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </div>
        <button
          type="submit"
          className="cursor-pointer rounded-full border-2 border-ink bg-ink px-5 py-3 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
        >
          Look up
        </button>
      </form>

      {lookupRaw && !recipient && (
        <div className="mt-8 rounded-2xl border-2 border-ink bg-white-smoke p-6 text-sm text-ink/80">
          No Whoosh wallet for{" "}
          <span className="font-heading font-bold">@{lookupRaw.replace(/^@/, "")}</span>
          . They need to sign in to the site at least once before a wallet row exists.
        </div>
      )}

      {recipient && (
        <section className="mt-8 space-y-6">
          {/* Identity + balance */}
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border-2 border-ink bg-blue p-6 text-ink sm:p-8">
            <div className="flex items-center gap-5 min-w-0">
              <Avatar
                id={recipient.discordUserId}
                hash={null}
                username={recipient.discordUsername}
                size={56}
                className="border-2 border-ink"
              />
              <div className="min-w-0">
                <div className="font-heading text-3xl font-black tracking-tight">
                  @{recipient.discordUsername}
                </div>
                <div className="mt-0.5 text-xs font-bold uppercase tracking-wider text-ink/60">
                  ID {recipient.discordUserId}
                  {memberSince && <> · joined {fmtDateTime(memberSince)}</>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-ink/70">
                Balance
              </div>
              <div className="mt-1 font-heading text-4xl font-black tabular-nums">
                {fmtMoney(balance)}
              </div>
            </div>
          </div>

          {/* Adjust form */}
          <div className="rounded-3xl border-2 border-ink bg-white-smoke p-6 sm:p-8">
            <h2 className="font-heading text-xl font-bold">Adjust balance</h2>
            <p className="mt-1 text-sm text-ink/60">
              Credit or debit WB. Posts as kind=<code>adjustment</code> on the ledger
              and is visible in the user&rsquo;s activity.
            </p>
            <form action={adjustWbAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input
                type="hidden"
                name="discord_user_id"
                value={recipient.discordUserId}
              />
              <input
                type="hidden"
                name="discord_username"
                value={recipient.discordUsername}
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-heading font-bold text-ink/60">
                  $
                </span>
                <input
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  required
                  inputMode="decimal"
                  aria-label="USD amount"
                  className="w-full rounded-full border-2 border-ink bg-white-smoke px-4 py-3 pl-8 text-right font-heading text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink"
                />
              </div>
              <button
                type="submit"
                name="op"
                value="add"
                className="cursor-pointer rounded-full border-2 border-ink bg-pigment-green px-5 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90"
              >
                Add WB
              </button>
              <button
                type="submit"
                name="op"
                value="remove"
                className="cursor-pointer rounded-full border-2 border-ink bg-imperial-red px-5 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90"
              >
                Remove WB
              </button>
              <input
                type="text"
                name="memo"
                placeholder="Memo (optional, shows in user's activity)"
                className="sm:col-span-3 rounded-full border-2 border-ink bg-white-smoke px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-ink"
              />
            </form>
            {balance < 0 && (
              <p className="mt-3 text-xs font-medium text-imperial-red">
                ⚠ This wallet would go negative on a debit. Removing more than the
                current balance is allowed but will leave the user owing WB.
              </p>
            )}
          </div>

          {/* Lifetime stats */}
          {dashboard && (
            <div className="rounded-3xl border-2 border-ink bg-white-smoke p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold">Lifetime stats</h2>
              <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <Stat label="Total equity" value={fmtMoney(dashboard.allocation.totalEquityCents)} />
                <Stat label="Money in (purchases)" value={fmtMoney(dashboard.returns.realDollarsInCents)} />
                <Stat label="Premium match" value={fmtMoney(dashboard.returns.premiumMatchCents, { signed: true })} />
                <Stat label="Interest earned" value={fmtMoney(dashboard.returns.interestEarnedCents, { signed: true })} />
                <Stat label="Wager P/L" value={fmtMoney(dashboard.returns.wagerPlCents, { signed: true })} />
                <Stat label="Investing P/L" value={fmtMoney(dashboard.returns.investingPlCents, { signed: true })} />
                <Stat label="Net transfers" value={fmtMoney(dashboard.returns.netTransfersCents, { signed: true })} />
                <Stat label="Open wager stakes" value={fmtMoney(dashboard.allocation.openWagersCents)} />
                <Stat label="Adjustments" value={fmtMoney(dashboard.returns.adjustmentsCents, { signed: true })} />
              </dl>
            </div>
          )}

          {/* Recent ledger */}
          <div className="rounded-3xl border-2 border-ink bg-white-smoke p-6 sm:p-8">
            <h2 className="font-heading text-xl font-bold">Recent activity</h2>
            {ledger.length === 0 ? (
              <p className="mt-4 text-sm text-ink/60">No ledger entries yet.</p>
            ) : (
              <ul className="mt-4 divide-y-2 divide-ink border-y-2 border-ink">
                {ledger.map((entry) => {
                  const positive = entry.amountCents >= 0;
                  return (
                    <li
                      key={entry.id}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 text-sm"
                    >
                      <div>
                        <div className="font-bold">
                          {KIND_LABEL[entry.kind] ?? entry.kind}
                        </div>
                        {entry.memo && (
                          <div className="text-xs text-ink/60">{entry.memo}</div>
                        )}
                      </div>
                      <div
                        className={`font-heading text-lg font-black tabular-nums ${
                          positive ? "text-pigment-green" : "text-imperial-red"
                        }`}
                      >
                        {fmtMoney(entry.amountCents, { signed: true })}
                      </div>
                      <div className="text-xs text-ink/60">
                        {fmtDateTime(entry.createdAt)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="mt-4 text-sm text-ink/60">
            <Link
              href="/admin/wb"
              className="font-bold underline underline-offset-2 hover:text-ink"
            >
              ← Back to Whoosh Bucks dashboard
            </Link>
          </p>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-ink/60">{label}</dt>
      <dd className="mt-1 font-heading text-xl font-black tabular-nums">{value}</dd>
    </div>
  );
}
