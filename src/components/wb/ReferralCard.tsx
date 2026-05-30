"use client";

import { useState } from "react";
import type { ReferralStats } from "@/lib/wb/referrals";

export function ReferralCard({ stats }: { stats: ReferralStats }) {
  const [copied, setCopied] = useState<"code" | "url" | null>(null);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/r/${stats.code}`
    : `https://whoosh.lol/r/${stats.code}`;

  function copy(value: string, which: "code" | "url") {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1500);
    });
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
            <span className="text-2xl font-black tabular-nums">
              {stats.code}
            </span>
            <button
              type="button"
              onClick={() => copy(stats.code, "code")}
              className="ml-auto tap-press cursor-pointer rounded-full border-theme border-ink bg-ink px-3 py-1 text-xs font-bold text-white-smoke transition-opacity hover:opacity-90"
            >
              {copied === "code" ? "Copied!" : "Copy"}
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
              {copied === "url" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Total" value={stats.totalReferred.toString()} />
        <Stat label="Joined Premium" value={stats.totalRewarded.toString()} />
        <Stat
          label="Earned"
          value={`$${(stats.totalRewardCents / 100).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
        />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-theme border-ink bg-surface p-3 text-center">
      <dt className="text-xs font-bold uppercase tracking-wider text-ink/60">{label}</dt>
      <dd className="mt-1 text-2xl font-black tabular-nums">{value}</dd>
    </div>
  );
}
