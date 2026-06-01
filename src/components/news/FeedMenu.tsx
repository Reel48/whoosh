"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SPORT_LIST } from "@/lib/news/espn";
import type { FeedActive } from "./SportSelector";

const ROW =
  "block w-full px-5 py-3.5 text-left font-display text-sm font-bold transition-colors";
const ROW_ACTIVE = "bg-lime text-ink";
const ROW_IDLE = "text-ink hover:bg-ink/5";

/** Slide animation duration; keep in sync with the `duration-300` classes. */
const ANIM_MS = 300;

type FeedLink = { href: string; label: string; active: boolean };

/**
 * Measure how much of the viewport the chrome occupies so the drawer can sit
 * BETWEEN the top navbar and the (mobile) bottom tab bar rather than over them.
 * Both selectors are stable: AppShell's header is sticky at top-0, and the
 * bottom tab bar is the only `nav[aria-label="Section"]` (display:none on
 * desktop, so its measured height is 0 there).
 */
function measureChrome(): { top: number; bottom: number } {
  if (typeof document === "undefined") return { top: 0, bottom: 0 };
  const header = document.querySelector("header");
  const bottomBar = document.querySelector('nav[aria-label="Section"]');
  return {
    top: header ? Math.round(header.getBoundingClientRect().height) : 0,
    bottom: bottomBar ? Math.round(bottomBar.getBoundingClientRect().height) : 0,
  };
}

/**
 * Hamburger button that opens a left sidebar drawer listing every feed as a
 * vertical row, so the viewer can jump straight to a feed (e.g. Boxing) without
 * scrolling the chip row. The drawer slides in/out smoothly and is inset
 * between the top and bottom navbars. Closes on backdrop click, Escape, and on
 * selecting a feed.
 */
export function FeedMenu({ active }: { active: FeedActive }) {
  // `mounted` keeps the drawer in the DOM through its exit animation; `shown`
  // drives the in/out transition.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [chrome, setChrome] = useState({ top: 0, bottom: 0 });
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setChrome(measureChrome());
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    setShown(false);
    closeTimer.current = setTimeout(() => setMounted(false), ANIM_MS);
  }, []);

  // Once mounted, flip to the shown state so the slide-in transition runs.
  // The double rAF lets the browser paint the initial (-translate-x-full) frame
  // before we switch to translate-x-0; a single frame would coalesce both into
  // one paint and skip the transition.
  useEffect(() => {
    if (!mounted) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [mounted]);

  // While open: lock background scroll, keep the drawer pinned between the
  // navbars on resize, close on Escape, and focus the close button.
  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onResize() {
      setChrome(measureChrome());
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, close]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const links: FeedLink[] = [
    { href: "/news", label: "Whoosh Feed", active: active === "whoosh" },
    { href: "/news?view=mine", label: "My Boosts", active: active === "mine" },
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
        aria-expanded={mounted}
        onClick={open}
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

      {mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed left-0 right-0 z-20"
          style={{ top: chrome.top, bottom: chrome.bottom }}
        >
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${
              shown ? "opacity-100" : "opacity-0"
            }`}
            onClick={close}
            aria-hidden="true"
          />
          {/* Sidebar */}
          <aside
            role="dialog"
            aria-label="All feeds"
            className={`absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-white shadow-xl transition-transform duration-300 ease-out ${
              shown ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <h2 className="font-display text-base font-bold text-ink">Feeds</h2>
              <button
                ref={closeRef}
                type="button"
                aria-label="Close"
                onClick={close}
                className="rounded-theme p-1 text-ink/60 outline-none transition-colors hover:bg-ink/5 hover:text-ink focus-visible:bg-ink/5 focus-visible:text-ink"
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
                  onClick={close}
                  className={`${ROW} ${l.active ? ROW_ACTIVE : ROW_IDLE}`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
