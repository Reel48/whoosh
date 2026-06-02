"use client";

import { useEffect, useState } from "react";
import type { TickerQuote } from "@/lib/wb/marketTicker";
import { Shimmer } from "@/components/ui/Shimmer";

/**
 * A thin market-quotes strip pinned to the top of the Capital section that
 * glides continuously across the screen (ESPN-style, mirroring the news
 * ScoreTicker). The track renders the watchlist twice and animates -50% so the
 * loop is seamless; it pauses on hover. Quotes refresh every 60s from
 * /api/capital/ticker. Renders nothing until the first quotes arrive.
 *
 * Colors come from the Capital design-system tokens (--surface, --text,
 * --positive-text, --negative-text, …), which resolve under the
 * [data-theme="capital"] scope this component renders inside.
 */
export function MarketTicker() {
  const [quotes, setQuotes] = useState<TickerQuote[] | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/capital/ticker");
        if (!r.ok) return;
        const j = (await r.json()) as { quotes: TickerQuote[] };
        if (alive) setQuotes(j.quotes);
      } catch {
        /* keep prior data */
      }
    }
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!quotes || quotes.length === 0) {
    // Before the first quotes land, show a quiet shimmer label instead of a
    // blank bar so the strip reads as "loading" rather than missing.
    return (
      <div
        className="overflow-hidden border-b"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="mx-auto flex h-9 w-full max-w-6xl items-center px-4">
          <Shimmer className="text-xs" >Loading market…</Shimmer>
        </div>
      </div>
    );
  }

  // Duplicate for a seamless loop; pace the glide to the amount of content.
  const loop = [...quotes, ...quotes];
  const durationS = Math.max(30, quotes.length * 4);

  return (
    <div
      className="group overflow-hidden border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mx-auto w-full max-w-6xl overflow-hidden">
        <div
          className="flex w-max group-hover:[animation-play-state:paused]"
          style={{ animation: `news-ticker ${durationS}s linear infinite` }}
        >
          {loop.map((q, i) => (
            <QuoteCell key={`${q.symbol}-${i}`} quote={q} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuoteCell({ quote }: { quote: TickerQuote }) {
  const up = quote.changePct >= 0;
  const price = (quote.priceCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const pct = `${up ? "+" : ""}${quote.changePct.toFixed(2)}%`;
  const deltaColor = up ? "var(--positive-text)" : "var(--negative-text)";

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-2 border-r px-4 text-xs"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        className="font-bold"
        style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
      >
        {quote.symbol}
      </span>
      <span
        className="tabular-nums"
        style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}
      >
        ${price}
      </span>
      <span
        className="font-semibold tabular-nums"
        style={{ fontFamily: "var(--font-mono)", color: deltaColor }}
      >
        {up ? "▲" : "▼"} {pct}
      </span>
    </div>
  );
}
