import { requireSession } from "@/lib/membership";
import { AppShell } from "@/components/AppShell";
import "@/styles/capital/index.css";
import "@/styles/capital/app.css";

export const dynamic = "force-dynamic";

/**
 * Capital section shell. Gates on premium once for every page below and sets
 * the `capital` theme scope. The section's entire visual identity comes from
 * its own vendored design system (src/styles/capital/index.css) — scoped to
 * [data-theme="capital"] so it shares no styling with the marketing site or
 * the other sections. The canvas background/text/font are painted by that
 * stylesheet, so the wrapper carries no color utilities.
 */
export default async function CapitalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession("/capital");
  return (
    <div data-theme="capital" className="flex flex-1 flex-col">
      <AppShell section="capital">{children}</AppShell>
    </div>
  );
}
