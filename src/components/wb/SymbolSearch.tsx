"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Suggestion = {
  symbol: string;
  name: string;
  kind: "stock" | "crypto";
};

/** Symbol search with autocomplete — Capital design system. */
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
        // ignore — fall back to form submit
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
    <div ref={wrapRef} className="cap-search">
      <form action="/capital/invest" method="GET" className="cap-search__form" onSubmit={() => setOpen(false)}>
        <input
          className="input"
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
          style={{ textTransform: "uppercase" }}
        />
        <button type="submit" className="btn btn-primary">Look up</button>
      </form>

      {open && results.length > 0 && (
        <ul id="symbol-search-listbox" role="listbox" className="cap-search__menu">
          {results.map((r, i) => (
            <li key={`${r.kind}:${r.symbol}`} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(r.symbol)}
                className={`cap-search__opt ${i === highlight ? "is-active" : ""}`}
              >
                <span className="cap-search__optmain">
                  <span className="num">{r.symbol}</span>
                  <span className="cap-search__optname">{r.name}</span>
                </span>
                <span className="badge badge-neutral badge-sm">{r.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
