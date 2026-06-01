"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, sectionForPath, type SectionKey } from "@/lib/sections";

/**
 * Persistent cross-section switcher for the signed-in app (desktop header).
 *
 * This replaces the old forced-isolation model where the only way from one
 * section to another was back through the /home hub. All four sections are now
 * one click apart, with the active one highlighted. Capital shows live Total
 * Equity as its label (the cross-section money context that used to live in a
 * standalone pill). Reads the active section from the pathname so it works on
 * the hub and inside any section. Rendered inside the section's data-theme
 * scope, so the pills adopt that section's tokens.
 */
const ORDER: SectionKey[] = ["capital", "fantasy", "news", "pool"];

export function SectionSwitcher({ equityLabel }: { equityLabel?: string | null }) {
  const pathname = usePathname();
  const active = sectionForPath(pathname);

  return (
    <nav aria-label="Sections" className="hidden min-w-0 items-center gap-1 sm:flex">
      {ORDER.map((key) => {
        const s = SECTIONS[key];
        const isActive = active === key;
        const isCapital = key === "capital";
        return (
          <Link
            key={key}
            href={s.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-theme px-3 py-1.5 text-sm font-display font-bold tabular-nums transition-colors ${
              isActive
                ? "bg-ink text-white"
                : "text-ink/55 hover:bg-ink/5 hover:text-ink"
            }`}
          >
            {isCapital && (
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-black ${
                  isActive ? "bg-white text-ink" : "bg-pigment-green text-white"
                }`}
              >
                $
              </span>
            )}
            <span className="truncate">
              {isCapital && equityLabel ? equityLabel : s.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
