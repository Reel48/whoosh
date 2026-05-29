"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTION_LIST, sectionForPath } from "@/lib/sections";

type IconProps = { className?: string };

function CapitalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function FantasyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(45 12 12)" />
      <path d="M9 9l6 6M10.5 7.5l1.5 1.5M7.5 10.5L9 12M15 12l1.5 1.5M12 15l1.5 1.5" />
    </svg>
  );
}
function PoolIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10z" />
    </svg>
  );
}
function AccountIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </svg>
  );
}

const SECTION_ICON: Record<string, (p: IconProps) => React.JSX.Element> = {
  capital: CapitalIcon,
  fantasy: FantasyIcon,
  pool: PoolIcon,
};

/**
 * Persistent bottom tab bar for signed-in mobile users — the global section
 * switch (Capital / Fantasy / Pool) plus Account. Within-section page nav
 * lives in the MobileRouteStrip at the top. Sits above the iPhone home
 * indicator (safe-area padding) and auto-hides when the keyboard is open.
 * Hidden on sm+ — desktop uses the header's SectionSwitcher.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const activeSection = sectionForPath(pathname);
  const accountActive = pathname === "/account" || pathname.startsWith("/account/");
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
      // If the visual viewport shrinks by >150px vs the window, assume
      // the on-screen keyboard is open.
      setKeyboardOpen(window.innerHeight - vv.height > 150);
    };
    vv.addEventListener("resize", onResize);
    onResize();
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  if (keyboardOpen) return null;

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="mx-auto grid w-full max-w-3xl grid-cols-4">
        {SECTION_LIST.map((s) => {
          const active = s.key === activeSection;
          const Icon = SECTION_ICON[s.key];
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold tap-press ${
                  active ? "text-ink" : "text-ink/45"
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? "" : "opacity-80"}`} />
                <span>{s.label}</span>
                {active && (
                  <span aria-hidden="true" className="absolute top-0 h-1 w-12 rounded-b-full bg-ink" />
                )}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/account"
            aria-current={accountActive ? "page" : undefined}
            className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold tap-press ${
              accountActive ? "text-ink" : "text-ink/45"
            }`}
          >
            <AccountIcon className={`h-6 w-6 ${accountActive ? "" : "opacity-80"}`} />
            <span>Account</span>
            {accountActive && (
              <span aria-hidden="true" className="absolute top-0 h-1 w-12 rounded-b-full bg-ink" />
            )}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
