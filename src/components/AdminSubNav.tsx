import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/subscribers", label: "Subscribers" },
];

/**
 * Sub-nav rendered under the main Nav on every /admin/* page. Visually
 * distinguishes "admin mode" with a dark band so admins always know they're
 * looking at internal data.
 */
export function AdminSubNav() {
  return (
    <div className="border-b-2 border-ink bg-ink text-white-smoke">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-3 text-sm">
        <span className="font-heading text-xs font-bold uppercase tracking-[0.22em] text-white-smoke/70">
          Admin
        </span>
        <nav className="flex items-center gap-6 font-medium">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="transition-opacity hover:opacity-80"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
