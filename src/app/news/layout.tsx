import { Suspense } from "react";
import { requireSession } from "@/lib/membership";
import { AppShell } from "@/components/AppShell";
import { ScoreTicker } from "@/components/news/ScoreTicker";
import { SportSelector } from "@/components/news/SportSelector";
import { NewsRevealBar } from "@/components/news/NewsRevealBar";

export const dynamic = "force-dynamic";

/**
 * Sports News section shell. Open to any signed-in member (like Fantasy — no
 * Premium gate) and sets the `news` theme scope. Unlike Capital/Fantasy, the
 * section has no vendored stylesheet: its look comes entirely from the
 * structural tokens in [data-theme="news"] (globals.css) over the shared
 * palette.
 */
export default async function NewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession("/news");
  return (
    <div data-theme="news" className="flex flex-1 flex-col bg-white text-ink">
      <AppShell section="news">
        {/* Ticker + feed selector ride together in a sticky bar that hides on
            scroll-down and slides back the moment the reader scrolls up. */}
        <NewsRevealBar>
          <ScoreTicker />
          <Suspense
            fallback={
              <div
                className="mx-auto flex w-full max-w-4xl items-stretch gap-2 px-6 py-3"
                aria-hidden
              />
            }
          >
            <SportSelector />
          </Suspense>
        </NewsRevealBar>
        {children}
      </AppShell>
    </div>
  );
}
