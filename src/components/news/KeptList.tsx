"use client";

import { useRef, useState } from "react";
import type { WhooshEntry } from "@/lib/news/engagement";
import { EspnLogo, formatArticleDate } from "./ArticleCard";

async function post(body: unknown) {
  try {
    await fetch("/api/news/swipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* best-effort; server is source of truth on next load */
  }
}

function keepBody(e: WhooshEntry) {
  return {
    action: "swipe",
    direction: "right",
    article: {
      guid: e.espnId,
      title: e.title,
      description: e.description,
      link: e.link,
      author: e.author,
      image: e.imageUrl,
      pubDate: e.pubDate,
      sport: e.sport,
    },
  };
}

/**
 * The user's personal library of kept articles. Same plain card look as the
 * Whoosh Feed (ESPN header, headline, hero image), plus a Remove control that
 * un-keeps the article (optimistic, with an Undo toast). Order is newest-kept
 * first, set server-side by getMyKeptArticles.
 */
export function KeptList({ entries }: { entries: WhooshEntry[] }) {
  const byId = new Map(entries.map((e) => [e.espnId, e]));
  const [order, setOrder] = useState<string[]>(() => entries.map((e) => e.espnId));
  const [toast, setToast] = useState<{ msg: string; onUndo: () => void } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  function showToast(msg: string, onUndo: () => void) {
    setToast({ msg, onUndo });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }

  function remove(id: string) {
    const idx = order.indexOf(id);
    setOrder((o) => o.filter((g) => g !== id));
    void post({ action: "undo", guid: id });
    showToast("Removed from boosts", () => {
      setOrder((o) => {
        if (o.includes(id)) return o;
        const next = [...o];
        next.splice(Math.min(idx, next.length), 0, id);
        return next;
      });
      const e = byId.get(id);
      if (e) void post(keepBody(e));
    });
  }

  if (order.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 pb-16">
        <div className="rounded-theme border-theme border-ink/10 bg-surface p-10 text-center shadow-theme">
          <p className="font-display text-lg font-bold text-ink">You haven&apos;t boosted anything yet</p>
          <p className="mt-2 text-sm text-ink/60">
            Swipe right to boost stories worth saving and they&apos;ll collect here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-16">
      <div className="grid gap-3">
        {order.map((id) => {
          const e = byId.get(id);
          if (!e) return null;
          const date = formatArticleDate(e.pubDate);
          const byline = [e.author, date].filter(Boolean).join(" · ");
          return (
            <div
              key={id}
              className="overflow-hidden rounded-theme border-theme border-ink/10 bg-surface shadow-theme"
            >
              <div className="p-5">
                <header className="flex items-center gap-3">
                  <EspnLogo />
                  <div className="min-w-0 leading-tight">
                    <p className="font-display text-sm font-bold text-ink">ESPN</p>
                    {byline && <p className="truncate text-xs text-ink/55">{byline}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    className="ml-auto inline-flex shrink-0 items-center rounded-full border-theme border-ink/15 px-3 py-1 text-xs font-bold text-ink/60 transition-colors hover:bg-ink/5"
                  >
                    Remove
                  </button>
                </header>

                <a href={e.link} target="_blank" rel="noopener noreferrer" className="group mt-3 block">
                  <h2 className="font-display text-lg font-bold leading-snug text-ink group-hover:underline">
                    {e.title}
                  </h2>
                  {e.description && <p className="mt-2 text-sm text-ink/70">{e.description}</p>}
                </a>
              </div>

              {e.imageUrl && (
                <a href={e.link} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={e.imageUrl}
                    alt=""
                    loading="lazy"
                    className="w-full border-t border-ink/10 object-cover"
                  />
                </a>
              )}
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 sm:bottom-6">
          <div className="flex items-center gap-3 rounded-full border-theme border-ink/15 bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
            <span>{toast.msg}</span>
            <button
              type="button"
              onClick={() => {
                toast.onUndo();
                setToast(null);
              }}
              className="font-display font-bold text-lime underline-offset-2 hover:underline"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
