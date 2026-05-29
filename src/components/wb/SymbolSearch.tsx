"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Suggestion = {
  symbol: string;
  name: string;
  kind: "stock" | "crypto";
};

export function SymbolSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    const q = value.trim();
    if (!q) {
      // Clear results in the next microtask so setState doesn't fire
      // synchronously inside the effect body.
      const t = window.setTimeout(() => setResults([]), 0);
      return () => window.clearTimeout(t);
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/wb/search?q=${encodeURIComponent(q)}`);
        if (!r.ok) return;
        const j = (await r.json()) as { results: Suggestion[] };
        setResults(j.results);
        setHighlight(0);
      } catch {
        // ignore network errors — fall back to form submit
      }
    }, 120);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [value]);

  function go(sym: string) {
    setOpen(false);
    setValue(sym);
    router.push(`/capital/invest?symbol=${encodeURIComponent(sym.toUpperCase().trim())}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (results[highlight]) {
        e.preventDefault();
        go(results[highlight].symbol);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative flex flex-1 flex-wrap gap-3 min-w-[180px]">
      <form
        action="/capital/invest"
        method="GET"
        className="flex flex-1 flex-wrap gap-3"
        onSubmit={() => setOpen(false)}
      >
        <input
          type="text"
          name="symbol"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Symbol (e.g. AAPL, BTC)"
          required
          autoComplete="off"
          role="combobox"
          aria-controls="symbol-search-listbox"
          aria-label="Symbol"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          className="flex-1 min-w-[180px] rounded-full border-theme border-ink bg-surface px-4 py-3 font-display font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-ink"
        />
        <button
          type="submit"
          className="tap-press cursor-pointer rounded-full border-theme border-ink bg-ink px-5 py-3 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
        >
          Look up
        </button>
      </form>

      {open && results.length > 0 && (
        <ul
          id="symbol-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border-theme border-ink bg-surface shadow-xl"
        >
          {results.map((r, i) => (
            <li key={`${r.kind}:${r.symbol}`} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(r.symbol)}
                className={`tap-press flex w-full min-h-[52px] items-center justify-between gap-3 px-4 py-3 text-left text-base sm:min-h-[44px] sm:text-sm ${
                  i === highlight ? "bg-ink text-white-smoke" : "bg-surface text-ink"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="font-display font-black tabular-nums">
                    {r.symbol}
                  </span>
                  <span
                    className={`truncate ${i === highlight ? "text-white-smoke/70" : "text-ink/60"}`}
                  >
                    {r.name}
                  </span>
                </span>
                <span
                  className={`rounded-full border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    r.kind === "crypto"
                      ? "border-current"
                      : "border-current"
                  }`}
                >
                  {r.kind}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
