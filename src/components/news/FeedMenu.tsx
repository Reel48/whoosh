"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SPORT_LIST } from "@/lib/news/espn";
import type { FeedActive } from "./SportSelector";

const ROW =
  "block w-full px-5 py-3.5 text-left font-display text-sm font-bold transition-colors";
const ROW_ACTIVE = "bg-ink text-white";
const ROW_IDLE = "text-ink hover:bg-ink/5";

type FeedLink = { href: string; label: string; active: boolean };

/**
 * Hamburger button that opens a left sidebar drawer listing every feed as a
 * vertical row, so the viewer can jump straight to a feed (e.g. Boxing) without
 * scrolling the chip row. Client-only: it owns the open/close state and closes
 * on backdrop click, Escape, and on selecting a feed.
 */
export function FeedMenu({ active }: { active: FeedActive }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the drawer is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const links: FeedLink[] = [
    { href: "/news", label: "Whoosh Feed", active: active === "whoosh" },
    { href: "/news?view=mine", label: "My Keeps", active: active === "mine" },
    ...SPORT_LIST.map((s) => ({
      href: `/news?sport=${s.key}`,
      label: s.label,
      active: s.key === active,
    })),
  ];

  return (
    <>
      <button
        type="button"
        aria-label="All feeds"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-full shrink-0 items-center rounded-theme border-theme border-ink/15 bg-surface px-4 py-2 text-ink transition-colors hover:bg-ink/5"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M2 4.5h14M2 9h14M2 13.5h14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Sidebar */}
          <aside
            role="dialog"
            aria-label="All feeds"
            className="absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <h2 className="font-display text-base font-bold text-ink">Feeds</h2>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-theme p-1 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <nav className="flex-1 divide-y divide-ink/10 overflow-y-auto">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={l.active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`${ROW} ${l.active ? ROW_ACTIVE : ROW_IDLE}`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
