import { requireSession } from "@/lib/membership";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

/**
 * Pool section shell. Gates on premium, sets the `pool` theme scope (soft,
 * calm — rounded display font, generous radius, soft shadow), and renders the
 * section chrome. Content is a placeholder for now.
 */
export default async function PoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession("/pool");
  return (
    <div data-theme="pool" className="flex flex-1 flex-col bg-white-smoke text-ink">
      <AppShell section="pool">{children}</AppShell>
    </div>
  );
}
