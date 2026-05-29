"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/sections";

/**
 * Desktop sub-navigation strip — the current section's pages, shown just under
 * the AppShell header on sm+ screens. Mobile uses MobileRouteStrip instead.
 * Single-page sections (placeholders) don't render a strip.
 */
export function SectionSubNav({ links }: { links: NavItem[] }) {
  const pathname = usePathname();
  if (links.length <= 1) return null;

  return (
    <div className="sticky top-[65px] z-20 hidden border-b border-ink/10 bg-white/80 backdrop-blur sm:block">
      <nav
        aria-label="Section pages"
        className="mx-auto flex w-full max-w-6xl gap-6 px-6 py-3 text-sm font-semibold"
      >
        {links.map((l) => {
          const active =
            pathname === l.href ||
            (l.href !== "/capital" && pathname.startsWith(`${l.href}/`));
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`font-display transition-colors hover:text-ink ${
                active
                  ? "text-ink underline decoration-2 underline-offset-[6px]"
                  : "text-ink/55"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
