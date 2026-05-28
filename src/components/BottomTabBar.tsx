"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  Icon: (p: { className?: string }) => React.JSX.Element;
};

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M16 12h3" />
      <path d="M3 10h15" />
    </svg>
  );
}
function InvestIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="14 7 21 7 21 14" />
    </svg>
  );
}
function EventsIcon({ className }: { className?: string }) {
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
function AccountIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </svg>
  );
}

const TABS: Tab[] = [
  { href: "/wallet", label: "Wallet", Icon: WalletIcon },
  { href: "/invest", label: "Invest", Icon: InvestIcon },
  { href: "/events", label: "Events", Icon: EventsIcon },
  { href: "/account", label: "Account", Icon: AccountIcon },
];

/**
 * Persistent bottom tab bar for signed-in mobile users. Sits above the
 * iPhone home indicator (safe-area padding) and auto-hides when the
 * software keyboard is open (visualViewport shorter than window).
 *
 * Hidden on sm+ — desktop uses the top nav.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Mark the body so the global stylesheet reserves space at the bottom.
  // Removed on unmount (sign-out / route change to a no-Nav layout).
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
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-white-smoke pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="mx-auto grid w-full max-w-3xl grid-cols-4">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-bold tap-press ${
                  active ? "text-ink" : "text-ink/55"
                }`}
              >
                <t.Icon className={`h-6 w-6 ${active ? "" : "opacity-80"}`} />
                <span>{t.label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 h-1 w-12 rounded-b-full bg-ink"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
