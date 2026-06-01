"use client";

import { useState } from "react";
import type { ReferralStats } from "@/lib/wb/referrals";

/**
 * Shared referral card, rendered in two skins (see LeaderboardTabs for the
 * pattern): "marketing" (default) uses Tailwind + shared theme tokens for the
 * account/landing pages; "capital" uses the vendored design-system classes
 * (.card, .btn, .kpi, .num) inside [data-theme="capital"]. Copy/URL/stats logic
 * lives once; only presentation and a couple of labels differ by variant.
 */
type Variant = "marketing" | "capital";

const fmtEarned = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function ReferralCard({
  stats,
  variant = "marketing",
}: {
  stats: ReferralStats;
  variant?: Variant;
}) {
  const [copied, setCopied] = useState<"code" | "url" | null>(null);
  // Use the public site URL (inlined identically on server + client, so no
  // hydration mismatch) rather than branching on window.
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://whoosh.business").replace(/\/+$/, "");
  const url = `${base}/r/${stats.code}`;

  function copy(value: string, which: "code" | "url") {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1500);
    });
  }

  const cap = variant === "capital";
  const copyLabel = (which: "code" | "url") =>
    copied === which ? (cap ? "Copied" : "Copied!") : "Copy";

  if (cap) {
    return (
      <section className="card">
        <h2 className="text-h3">Refer a friend, both get $50 WB</h2>
        <p className="text-body-sm cap-mt-1">
          Share your code. When they subscribe to Whoosh Premium, you and they each get $50 WB.
        </p>

        <div className="cap-cols cap-mt-sm">
          <div className="card cap-ref">
            <p className="kpi__label">Your code</p>
            <div className="cap-ref__row">
              <span className="num cap-ref__value">{stats.code}</span>
              <button type="button" onClick={() => copy(stats.code, "code")} className="btn btn-secondary btn-sm">
                {copyLabel("code")}
              </button>
            </div>
          </div>
          <div className="card cap-ref">
            <p className="kpi__label">Share link</p>
            <div className="cap-ref__row">
              <span className="cap-ref__url num">{url}</span>
              <button type="button" onClick={() => copy(url, "url")} className="btn btn-secondary btn-sm">
                {copyLabel("url")}
              </button>
            </div>
          </div>
        </div>

        <dl className="cap-ref__stats cap-mt-sm">
          <Stat variant={variant} label="Referred" value={stats.totalReferred.toString()} />
          <Stat variant={variant} label="Joined Premium" value={stats.totalRewarded.toString()} />
          <Stat variant={variant} label="Earned" value={fmtEarned(stats.totalRewardCents)} />
        </dl>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-theme shadow-theme border-theme border-ink bg-surface p-6 text-ink sm:p-8">
      <h2 className="font-display text-xl font-bold">Refer a friend, both get $50 WB</h2>
      <p className="mt-1 text-sm font-medium text-ink/80">
        Share your code. When they subscribe to Whoosh Premium, you and they
        each get $50 WB credited to your wallets.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-theme border-ink bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Your code</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl font-black tabular-nums">{stats.code}</span>
            <button
              type="button"
              onClick={() => copy(stats.code, "code")}
              className="ml-auto tap-press cursor-pointer rounded-full border-theme border-ink bg-ink px-3 py-1 text-xs font-bold text-white-smoke transition-opacity hover:opacity-90"
            >
              {copyLabel("code")}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border-theme border-ink bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Share link</p>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-medium tabular-nums">{url}</span>
            <button
              type="button"
              onClick={() => copy(url, "url")}
              className="ml-auto tap-press cursor-pointer rounded-full border-theme border-ink bg-ink px-3 py-1 text-xs font-bold text-white-smoke transition-opacity hover:opacity-90"
            >
              {copyLabel("url")}
            </button>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Stat variant={variant} label="Total" value={stats.totalReferred.toString()} />
        <Stat variant={variant} label="Joined Premium" value={stats.totalRewarded.toString()} />
        <Stat variant={variant} label="Earned" value={fmtEarned(stats.totalRewardCents)} />
      </dl>
    </section>
  );
}

function Stat({ variant, label, value }: { variant: Variant; label: string; value: string }) {
  if (variant === "capital") {
    return (
      <div className="cap-ref__stat">
        <dt className="kpi__label">{label}</dt>
        <dd className="num cap-ref__statval">{value}</dd>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border-theme border-ink bg-surface p-3 text-center">
      <dt className="text-xs font-bold uppercase tracking-wider text-ink/60">{label}</dt>
      <dd className="mt-1 text-2xl font-black tabular-nums">{value}</dd>
    </div>
  );
}
