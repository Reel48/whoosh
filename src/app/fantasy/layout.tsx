import { requirePremiumSession } from "@/lib/membership";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

/**
 * Fantasy Football section shell. Gates on premium, sets the `fantasy` theme
 * scope (bold, sporty — condensed display font, chunky structure), and renders
 * the section chrome. Content is a placeholder for now.
 */
export default async function FantasyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePremiumSession();
  return (
    <div data-theme="fantasy" className="flex flex-1 flex-col bg-white-smoke text-ink">
      <AppShell section="fantasy">{children}</AppShell>
    </div>
  );
}
