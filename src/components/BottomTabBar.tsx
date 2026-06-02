"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SectionKey } from "@/lib/sections";

type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function CapitalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M14.5 9.3C14 8.5 13 8 12 8c-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.3" />
    </svg>
  );
}
function FantasyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
      <path d="M12 12v4M9 20h6M10 16h4l1 4H9l1-4z" />
    </svg>
  );
}
function NewsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h12v14H5a1 1 0 0 1-1-1V5z" />
      <path d="M16 8h3a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2" />
      <path d="M7 8h6M7 12h6M7 16h4" />
    </svg>
  );
}
function PoolIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c3 3.5 4.5 6 4.5 8.5a4.5 4.5 0 0 1-9 0C7.5 9 9 6.5 12 3z" />
    </svg>
  );
}

type Tab = {
  href: string;
  label: string;
  Icon: (p: IconProps) => React.JSX.Element;
  /** The section this tab represents (null = the Home hub). */
  section: SectionKey | null;
};

const TABS: Tab[] = [
  { href: "/home", label: "Home", Icon: HomeIcon, section: null },
  { href: "/capital", label: "Capital", Icon: CapitalIcon, section: "capital" },
  { href: "/fantasy", label: "Fantasy", Icon: FantasyIcon, section: "fantasy" },
  { href: "/news", label: "News", Icon: NewsIcon, section: "news" },
  { href: "/pool", label: "Pool", Icon: PoolIcon, section: "pool" },
];

/**
 * Persistent bottom tab bar for signed-in mobile users — the GLOBAL section
 * switcher. Home (the hub) plus the four sections, all one tap apart. The
 * current section's own pages live in the route strip under the header, not
 * here. Highlights the active section (passed from AppShell, which derives it
 * server-side) so it's correct on first paint.
 *
 * Sits above the iPhone home indicator (safe-area padding) and auto-hides when
 * the keyboard is open. Hidden on sm+ — desktop uses the header switcher.
 *
 * Positioning: rather than `fixed bottom-0` (which Android Chrome fails to keep
 * glued to the viewport bottom while the URL bar retracts on scroll — it leaves
 * a gap below the bar), the bar lives at the bottom of a `top-0`, 100dvh fixed
 * frame. Top-anchored fixed elements track the visible viewport reliably on
 * every mobile browser, and `100dvh` follows the live (URL-bar-aware) viewport
 * height, so the frame's bottom edge — and the bar with it — stays pinned to
 * the real bottom. The frame is click-through (`pointer-events-none`); only the
 * bar re-enables pointer events.
 */
export function BottomTabBar({ activeSection }: { activeSection: SectionKey | null }) {
  const pathname = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Mark the body so the global stylesheet reserves space at the bottom.
  useEffect(() => {
    document.body.dataset.hasBottomBar = "true";
    return () => {
      delete document.body.dataset.hasBottomBar;
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      setKeyboardOpen(window.innerHeight - vv.height > 150);
    };
    vv.addEventListener("resize", onResize);
    onResize();
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  if (keyboardOpen) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-30 flex flex-col justify-end sm:hidden"
      style={{ height: "100dvh" }}
    >
      <nav
        aria-label="Sections"
        className="pointer-events-auto border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <ul
        className="mx-auto grid w-full max-w-3xl"
        style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}
      >
        {TABS.map((t) => {
          // The Home tab matches only the hub; section tabs match their section
          // anywhere within it. Prefer the server-derived activeSection so the
          // highlight is right before hydration.
          const active =
            t.section === null
              ? pathname === t.href
              : activeSection === t.section ||
                pathname === t.href ||
                pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold tap-press ${
                  active ? "text-ink" : "text-ink/45"
                }`}
              >
                <t.Icon className={`h-6 w-6 ${active ? "" : "opacity-80"}`} />
                <span>{t.label}</span>
                {active && (
                  <span aria-hidden="true" className="absolute bottom-0 h-1 w-12 rounded-t-full bg-ink" />
                )}
              </Link>
            </li>
          );
        })}
        </ul>
      </nav>
    </div>
  );
}
