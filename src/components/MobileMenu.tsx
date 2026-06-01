"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";

type Props = {
  signedIn: boolean;
  username: string | null;
};

const SECTIONS_HOME = [
  { href: "/#channels", label: "Channels" },
  { href: "/#bucks", label: "Whoosh Bucks" },
  { href: "/#plans", label: "Plans" },
  { href: "/#faq", label: "FAQ" },
];

const SIGNED_IN_LINKS = [
  { href: "/home", label: "App home" },
  { href: "/capital", label: "Capital" },
  { href: "/fantasy", label: "Fantasy" },
  { href: "/pool", label: "Pool" },
  { href: "/account", label: "Account" },
];

export function MobileMenu({ signedIn, username }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const lastPathnameRef = useRef(pathname);

  // Close the sheet whenever the route changes. Tracking the last pathname
  // in a ref keeps the effect's setState idempotent — it only fires on a
  // real change, not on every render.
  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-white-smoke transition-colors hover:bg-ink hover:text-white-smoke sm:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          width={20}
          height={20}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 top-[71px] z-40 flex flex-col bg-white-smoke pb-[env(safe-area-inset-bottom)] sm:hidden">
          <nav className="flex flex-col gap-2 overflow-y-auto px-6 py-8">
            {signedIn && (
              <>
                <p className="mb-1 text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink/60">
                  Your stuff
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {SIGNED_IN_LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`rounded-2xl border-2 border-ink px-4 py-3 font-heading text-base font-bold ${
                        pathname === l.href
                          ? "bg-ink text-white-smoke"
                          : "bg-white-smoke text-ink"
                      }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
                <div className="my-4 h-px bg-ink/15" />
              </>
            )}

            <p className="mb-1 text-xs font-heading font-bold uppercase tracking-[0.22em] text-ink/60">
              Explore
            </p>
            {SECTIONS_HOME.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-2xl px-4 py-3 font-heading text-lg font-bold text-ink hover:bg-ink/5"
              >
                {l.label}
              </a>
            ))}


            <div className="my-4 h-px bg-ink/15" />

            {signedIn ? (
              <div className="rounded-2xl border-2 border-ink bg-white-smoke px-4 py-3 text-sm">
                <p className="font-medium text-ink/70">Signed in as</p>
                <p className="mt-1 font-heading font-bold text-ink">
                  @{username ?? "you"}
                </p>
                <form action={signOut} className="mt-3">
                  <button
                    type="submit"
                    className="cursor-pointer text-sm font-bold text-ink/70 underline-offset-2 hover:underline"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <a
                href="/login?next=/account"
                className="rounded-2xl border-2 border-ink bg-ink px-4 py-3 text-center font-heading text-base font-bold text-white-smoke"
              >
                Sign in
              </a>
            )}
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}
