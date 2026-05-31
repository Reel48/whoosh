import { requireSession } from "@/lib/membership";
import { AppShell } from "@/components/AppShell";
import "@/styles/fantasy/index.css";
import "@/styles/fantasy/app.css";

export const dynamic = "force-dynamic";

/**
 * Fantasy Football section shell. Open to any signed-in member (access to each
 * league is sold per-league, not via Premium) and sets the `fantasy` theme
 * scope. Like Capital, the section's entire
 * visual identity comes from its own vendored design system
 * (src/styles/fantasy/index.css) — scoped to [data-theme="fantasy"] so it
 * shares no styling with the marketing site or the other sections. That
 * stylesheet paints the canvas/text/font, so the wrapper carries no color
 * utilities.
 */
export default async function FantasyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession("/fantasy");
  return (
    <div data-theme="fantasy" className="flex flex-1 flex-col">
      <AppShell section="fantasy">{children}</AppShell>
    </div>
  );
}
