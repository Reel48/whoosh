"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDisclosureTransition } from "@/components/ui/useDisclosureTransition";

type Suggestion = { symbol: string; name: string; kind: "stock" | "crypto" };

// Default suggestions shown when the box is focused but empty. Stocks only —
// crypto stays discoverable by typing, not surfaced by default.
const POPULAR: Suggestion[] = [
  { symbol: "AAPL", name: "Apple", kind: "stock" },
  { symbol: "NVDA", name: "NVIDIA", kind: "stock" },
  { symbol: "TSLA", name: "Tesla", kind: "stock" },
  { symbol: "AMZN", name: "Amazon", kind: "stock" },
  { symbol: "MSFT", name: "Microsoft", kind: "stock" },
  { symbol: "META", name: "Meta Platforms", kind: "stock" },
  { symbol: "GOOGL", name: "Alphabet (Google)", kind: "stock" },
  { symbol: "SPY", name: "S&P 500 ETF", kind: "stock" },
];

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

/** Asset search with live typeahead (stocks + crypto) — Capital design system. */
export function SymbolSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const { mounted, stateClass } = useDisclosureTransition(open);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const seqRef = useRef(0);

  const q = value.trim();
  const isEmpty = q.length === 0;
  const upper = q.toUpperCase();

  // Rows the user can navigate: popular when empty, else results + a catch-all
  // "Search '<query>'" row so ANY ticker is reachable, not just matched ones.
  const showCatchAll = !isEmpty && upper !== results[0]?.symbol;
  type Row = { kind: "item"; item: Suggestion } | { kind: "catchall"; query: string };
  const rows: Row[] = isEmpty
    ? POPULAR.map((item) => ({ kind: "item", item }))
    : [
        ...results.map((item) => ({ kind: "item", item }) as Row),
        ...(showCatchAll ? [{ kind: "catchall", query: upper } as Row] : []),
      ];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    // Empty query: nothing to fetch. `rows` falls back to POPULAR, so any
    // stale results are ignored — no need to clear state synchronously here.
    if (!q) return;
    debounceRef.current = window.setTimeout(async () => {
      const seq = ++seqRef.current;
      setLoading(true);
      try {
        const r = await fetch(`/api/wb/search?q=${encodeURIComponent(q)}`);
        if (!r.ok) return;
        const j = (await r.json()) as { results: Suggestion[] };
        // Ignore responses that arrived out of order (an older query resolving
        // after a newer one) so the list always reflects the latest keystrokes.
        if (seq !== seqRef.current) return;
        setResults(j.results);
        setHighlight(-1);
      } catch {
        // ignore — the catch-all row still lets the user look up the raw query
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 140);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [q]);

  function go(symbol: string) {
    const sym = symbol.toUpperCase().trim();
    if (!sym) return;
    setOpen(false);
    setValue(sym);
    inputRef.current?.blur();
    router.push(`/capital/invest?symbol=${encodeURIComponent(sym)}`);
  }

  function activate(row: Row) {
    go(row.kind === "item" ? row.item.symbol : row.query);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && highlight >= 0 && rows[highlight]) {
        e.preventDefault();
        activate(rows[highlight]);
      } else if (q) {
        e.preventDefault();
        go(upper); // raw query → reach any ticker
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="cap-search">
      <form action="/capital/invest" method="GET" className="cap-search__form" onSubmit={() => setOpen(false)}>
        <div className="cap-search__field">
          <SearchIcon className="cap-search__icon" />
          <input
            ref={inputRef}
            className="cap-search__input"
            type="text"
            name="symbol"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search by company or ticker (e.g. Apple, AAPL)"
            required
            autoComplete="off"
            role="combobox"
            aria-controls="symbol-search-listbox"
            aria-label="Search assets"
            aria-autocomplete="list"
            aria-expanded={open}
          />
          {value && (
            <button
              type="button"
              className="cap-search__clear"
              aria-label="Clear"
              onClick={() => {
                setValue("");
                setResults([]);
                setHighlight(-1);
                inputRef.current?.focus();
              }}
            >
              ×
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {mounted && (
        <div
          id="symbol-search-listbox"
          role="listbox"
          data-origin="top-center"
          className={`t-dropdown ${stateClass} cap-search__menu`}
        >
          {isEmpty && <div className="cap-search__menuhead">Popular</div>}

          {rows.map((row, i) => {
            const active = i === highlight;
            if (row.kind === "catchall") {
              return (
                <button
                  key="__catchall"
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => activate(row)}
                  className={`cap-search__opt cap-search__opt--catchall ${active ? "is-active" : ""}`}
                >
                  <span className="cap-search__optmain">
                    <SearchIcon className="cap-search__opticon" />
                    <span>Look up “<span className="num">{row.query}</span>”</span>
                  </span>
                </button>
              );
            }
            const { item } = row;
            return (
              <button
                key={`${item.kind}:${item.symbol}`}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => activate(row)}
                className={`cap-search__opt ${active ? "is-active" : ""}`}
              >
                <span className="cap-search__optmain">
                  <span className="num cap-search__optsym">{item.symbol}</span>
                  <span className="cap-search__optname">{item.name}</span>
                </span>
                <span className={`badge ${item.kind === "crypto" ? "badge-premium" : "badge-neutral"} badge-sm`}>
                  {item.kind === "crypto" ? "Crypto" : "Stock"}
                </span>
              </button>
            );
          })}

          {!isEmpty && loading && results.length === 0 && (
            <div className="cap-search__hint">Searching…</div>
          )}
        </div>
      )}
    </div>
  );
}
