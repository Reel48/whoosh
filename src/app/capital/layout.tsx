import { requirePremiumSession } from "@/lib/membership";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

/**
 * Capital section shell. Gates on premium once for every page below, sets the
 * `capital` theme scope (clean finance: white surfaces, hairline borders, soft
 * shadows, tabular display font — see globals.css), and renders the section
 * chrome. The WB feature pages live underneath and inherit all of this.
 */
export default async function CapitalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePremiumSession();
  return (
    <div data-theme="capital" className="flex flex-1 flex-col bg-white text-ink">
      <AppShell section="capital">{children}</AppShell>
    </div>
  );
}
