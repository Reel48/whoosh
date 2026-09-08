"use client";

import { useState } from "react";
import type { PoolInvite } from "@/lib/fantasy/poolEntry";

/**
 * One tap to copy every invite as a labeled list — so a buyer who paid for
 * both pools can paste the pair into Notes or a text before opening Sleeper,
 * instead of coming back for the second link (and maybe losing the page).
 */
export function CopyAllLinks({ invites }: { invites: PoolInvite[] }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = invites.map((i) => `${i.name}: ${i.joinUrl}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — each card still has its own copy button.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="mt-6 inline-flex w-full items-center justify-center rounded-full border-2 border-ink bg-white-smoke px-6 py-3 text-base font-bold text-ink transition-colors hover:bg-ink hover:text-white-smoke"
    >
      {copied ? "Copied both links!" : `Copy all ${invites.length} links`}
    </button>
  );
}
