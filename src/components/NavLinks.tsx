"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Marketing-only nav links. The signed-in app navigates via AppShell
// (the /home hub + per-section sub-nav), not this component.
const MARKETING_LINKS = [
  { href: "/#channels", label: "Channels" },
  { href: "/#bucks", label: "Whoosh Bucks" },
  { href: "/#plans", label: "Plans" },
  { href: "/#faq", label: "FAQ" },
];

export function NavLinks() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  return (
    <>
      {MARKETING_LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`hidden hover:underline sm:inline ${
            onHome ? "" : "text-ink/70"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}
