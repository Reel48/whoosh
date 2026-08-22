"use client";

import { useState } from "react";

/**
 * A paid buyer's Sleeper invite: one big tap-target to open it, plus copy —
 * because the invite is the only thing they walk away with, and plenty of
 * people will want to paste it into their phone rather than open it here.
 */
export function InviteLink({ name, joinUrl }: { name: string; joinUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the link itself
      // is still right there to open or long-press.
    }
  }

  return (
    <div className="rounded-3xl border-2 border-ink bg-white p-6 sm:p-7">
      <h3 className="font-heading text-2xl font-black tracking-tight">{name}</h3>
      <p className="mt-3 break-all rounded-2xl border-2 border-ink bg-white-smoke px-4 py-3 font-mono text-sm">
        {joinUrl}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center rounded-full border-2 border-ink bg-ink px-6 py-3 text-base font-bold text-white-smoke transition-opacity hover:opacity-90"
        >
          Open in Sleeper ↗
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center justify-center rounded-full border-2 border-ink bg-white-smoke px-6 py-3 text-base font-bold text-ink transition-colors hover:bg-ink hover:text-white-smoke"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
