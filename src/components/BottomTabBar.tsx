"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, type IconKey, type SectionKey } from "@/lib/sections";

type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function WalletIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M16 12h3" />
      <path d="M3 10h15" />
    </svg>
  );
}
function InvestIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  );
}
function EventsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" />
    </svg>
  );
}
function BetsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}
function OverviewIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function LeaguesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
      <path d="M12 12v4M9 20h6M10 16h4l1 4H9l1-4z" />
    </svg>
  );
}
function MatchupsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h6v12H4zM14 6h6v12h-6z" />
      <path d="M11 12h2" />
    </svg>
  );
}
function PlayersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 6.5a3 3 0 0 1 0 5M18 20c0-2.4-1.2-4.2-3-5" />
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

const ICONS: Record<IconKey, (p: IconProps) => React.JSX.Element> = {
  wallet: WalletIcon,
  invest: InvestIcon,
  events: EventsIcon,
  bets: BetsIcon,
  overview: OverviewIcon,
  leagues: LeaguesIcon,
  matchups: MatchupsIcon,
  players: PlayersIcon,
};

type Tab = {
  href: string;
  label: string;
  Icon: (p: IconProps) => React.JSX.Element;
  /** Matches when pathname equals href or is nested under it. */
  prefix?: boolean;
};

/**
 * Persistent bottom tab bar for signed-in mobile users — SECTION-INTERNAL.
 * It never links to other sections; the only way out is the Home tab (the
 * hub). Layout: Home · the current section's primary tabs · Account.
 *
 * Sits above the iPhone home indicator (safe-area padding) and auto-hides
 * when the keyboard is open. Hidden on sm+ — desktop uses the header back
 * button + sub-nav. Only rendered inside a section (see AppShell).
 */
export function BottomTabBar({ section }: { section: SectionKey }) {
  const pathname = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const tabs: Tab[] = [
    { href: "/home", label: "Home", Icon: HomeIcon },
    ...SECTIONS[section].tabs.map((t) => ({
      href: t.href,
      label: t.label,
      Icon: ICONS[t.icon],
      prefix: true,
    })),
    { href: "/account", label: "Account", Icon: AccountIcon, prefix: true },
  ];

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
    <nav
      aria-label="Section"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul
        className="mx-auto grid w-full max-w-3xl"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => {
          const active = t.prefix
            ? pathname === t.href || pathname.startsWith(`${t.href}/`)
            : pathname === t.href;
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
                  <span aria-hidden="true" className="absolute top-0 h-1 w-12 rounded-b-full bg-ink" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
