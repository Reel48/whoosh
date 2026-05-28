"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SIGNED_OUT_LINKS = [
  { href: "/#channels", label: "Channels", match: (p: string) => p === "/" },
  { href: "/#bucks", label: "Whoosh Bucks", match: (p: string) => p === "/" },
  { href: "/#plans", label: "Plans", match: (p: string) => p === "/" },
  { href: "/#faq", label: "FAQ", match: (p: string) => p === "/" },
];

const SIGNED_IN_LINKS = [
  { href: "/wallet", label: "Wallet", match: (p: string) => p === "/wallet" || p.startsWith("/wallet/") },
  { href: "/invest", label: "Invest", match: (p: string) => p === "/invest" },
  { href: "/events", label: "Events", match: (p: string) => p === "/events" },
  { href: "/events/mine", label: "My bets", match: (p: string) => p === "/events/mine" },
];

export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const links = signedIn ? SIGNED_IN_LINKS : SIGNED_OUT_LINKS;
  return (
    <>
      {links.map((l) => {
        const isActive = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`hidden hover:underline sm:inline ${
              isActive ? "underline underline-offset-4 decoration-2" : ""
            }`}
          >
            {l.label}
          </Link>
        );
      })}
      {signedIn && (
        <Link
          href="/#bucks"
          className="hidden text-ink/60 hover:underline lg:inline"
        >
          About WB
        </Link>
      )}
    </>
  );
}
