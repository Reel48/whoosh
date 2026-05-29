"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTION_LIST, sectionForPath } from "@/lib/sections";

/**
 * Top-level section switch (Capital / Fantasy / Pool) shown in the AppShell
 * header on desktop. The active section is derived from the current path.
 * Uses the shared palette; structural feel (radius/border) comes from the
 * active section's [data-theme] scope via the theme utilities.
 */
export function SectionSwitcher() {
  const pathname = usePathname();
  const active = sectionForPath(pathname);

  return (
    <nav
      aria-label="Sections"
      className="hidden items-center gap-1 rounded-theme border-theme border-ink/15 p-1 sm:flex"
    >
      {SECTION_LIST.map((s) => {
        const isActive = s.key === active;
        return (
          <Link
            key={s.key}
            href={s.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-theme px-3.5 py-1.5 font-display text-sm font-bold transition-colors ${
              isActive
                ? "bg-ink text-white"
                : "text-ink/60 hover:bg-ink/5 hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
