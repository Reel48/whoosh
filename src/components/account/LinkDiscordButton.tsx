"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Bolt } from "@/components/Bolt";

/**
 * Starts Supabase manual identity linking for Discord. Must run client-side
 * (linkIdentity acts on the current browser session). On success Supabase
 * returns an OAuth URL we redirect to; it lands back on /auth/callback, which
 * records the Discord id and claims any legacy wallet.
 */
export function LinkDiscordButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase.auth.linkIdentity({
        provider: "discord",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/account` },
      });
      if (error || !data?.url) {
        setError(error?.message ?? "Could not start Discord linking.");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Discord linking.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={link}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-blue px-5 py-2.5 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Bolt className="h-4 w-4" /> {busy ? "Connecting…" : "Connect Discord"}
      </button>
      {error && <span className="text-xs font-medium text-imperial-red">{error}</span>}
    </div>
  );
}
