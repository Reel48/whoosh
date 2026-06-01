import Link from "next/link";

const ACTIVE = "border-ink bg-ink text-white";
const IDLE = "border-ink/15 bg-surface text-ink hover:bg-ink/5";

/**
 * Community vs. My Keeps switch on the Whoosh Feed page. Community is bare
 * /news; My Keeps is /news?view=mine. Both keep the Whoosh Feed chip active.
 */
export function FeedToggle({ active }: { active: "community" | "mine" }) {
  return (
    <div className="mx-auto -mt-1 mb-1 flex w-full max-w-2xl gap-2 px-6">
      <Link
        href="/news"
        aria-current={active === "community" ? "page" : undefined}
        className={`rounded-theme border-theme px-4 py-1.5 font-display text-sm font-bold transition-colors ${
          active === "community" ? ACTIVE : IDLE
        }`}
      >
        Community
      </Link>
      <Link
        href="/news?view=mine"
        aria-current={active === "mine" ? "page" : undefined}
        className={`rounded-theme border-theme px-4 py-1.5 font-display text-sm font-bold transition-colors ${
          active === "mine" ? ACTIVE : IDLE
        }`}
      >
        My Keeps
      </Link>
    </div>
  );
}
