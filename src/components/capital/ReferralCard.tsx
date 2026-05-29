"use client";

import { useState } from "react";
import type { ReferralStats } from "@/lib/wb/referrals";

/**
 * Capital design-system version of the referral card. Forked from
 * components/wb/ReferralCard so the marketing/account version stays untouched.
 * Styled with design-system component classes (.card, .btn, .kpi, .num).
 */
export function ReferralCard({ stats }: { stats: ReferralStats }) {
  const [copied, setCopied] = useState<"code" | "url" | null>(null);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${stats.code}`
      : `https://whoosh.lol/r/${stats.code}`;

  function copy(value: string, which: "code" | "url") {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1500);
    });
  }

  const earned = `$${(stats.totalRewardCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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
              {copied === "code" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <div className="card cap-ref">
          <p className="kpi__label">Share link</p>
          <div className="cap-ref__row">
            <span className="cap-ref__url num">{url}</span>
            <button type="button" onClick={() => copy(url, "url")} className="btn btn-secondary btn-sm">
              {copied === "url" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <dl className="cap-ref__stats cap-mt-sm">
        <Stat label="Referred" value={stats.totalReferred.toString()} />
        <Stat label="Joined Premium" value={stats.totalRewarded.toString()} />
        <Stat label="Earned" value={earned} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="cap-ref__stat">
      <dt className="kpi__label">{label}</dt>
      <dd className="num cap-ref__statval">{value}</dd>
    </div>
  );
}
