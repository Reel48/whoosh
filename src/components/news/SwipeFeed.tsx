"use client";

import { useRef, useState } from "react";
import type { Article, SportKey } from "@/lib/news/espn";
import { EspnLogo, formatArticleDate } from "./ArticleCard";

/** Horizontal drag distance (px) to commit a swipe. */
const THRESHOLD = 90;
/** Movement (px) above which a pointer gesture counts as a drag, not a tap. */
const SLOP = 8;

type Props = {
  sport: SportKey;
  articles: Article[];
  /** guids the user has already kept (render green on load). */
  initialKept: Record<string, boolean>;
};

type SwipeResponse = { ok: boolean; points?: number };

async function postSwipe(body: unknown): Promise<number | null> {
  try {
    const r = await fetch("/api/news/swipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as SwipeResponse;
    return j.ok ? j.points ?? 0 : null;
  } catch {
    return null;
  }
}

function payload(sport: SportKey, a: Article) {
  return {
    guid: a.guid,
    title: a.title,
    description: a.description,
    link: a.link,
    author: a.author,
    image: a.images[0] ?? null,
    pubDate: a.pubDate,
    sport,
  };
}

/**
 * The swipeable sport feed. Each article is a card the user can drag left to
 * trash (removed from their feed) or right to keep (stays, turns green, +1
 * point). Keep/Trash buttons do the same for desktop and keyboard users. Writes
 * are optimistic with a background POST and an Undo toast.
 */
export function SwipeFeed({ sport, articles, initialKept }: Props) {
  const byGuid = new Map(articles.map((a) => [a.guid, a]));
  const [order, setOrder] = useState<string[]>(() => articles.map((a) => a.guid));
  // guid -> points (number) when kept; null = kept but count unknown (on load).
  const [kept, setKept] = useState<Record<string, number | null>>(() => {
    const k: Record<string, number | null> = {};
    for (const g of Object.keys(initialKept)) if (initialKept[g]) k[g] = null;
    return k;
  });
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; onUndo: () => void } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  function showToast(msg: string, onUndo: () => void) {
    setToast({ msg, onUndo });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  }

  function reinsert(guid: string, idx: number) {
    setOrder((o) => {
      if (o.includes(guid)) return o;
      const next = [...o];
      next.splice(Math.min(idx, next.length), 0, guid);
      return next;
    });
  }

  function clearKept(guid: string) {
    setKept((k) => {
      if (!(guid in k)) return k;
      const next = { ...k };
      delete next[guid];
      return next;
    });
  }

  // Undo a keep: revert to idle (un-swiped) and delete the swipe server-side.
  function undoKeep(guid: string) {
    clearKept(guid);
    void postSwipe({ action: "undo", guid });
  }

  async function keep(guid: string) {
    const article = byGuid.get(guid);
    if (!article || pending[guid]) return;
    setKept((k) => ({ ...k, [guid]: k[guid] ?? null })); // optimistic green
    setPending((p) => ({ ...p, [guid]: true }));
    const points = await postSwipe({ action: "swipe", direction: "right", article: payload(sport, article) });
    setPending((p) => ({ ...p, [guid]: false }));
    if (points == null) {
      clearKept(guid);
      showToast("Couldn't save — try again", () => {});
      return;
    }
    setKept((k) => ({ ...k, [guid]: points }));
    showToast("Kept · +1 point", () => undoKeep(guid));
  }

  async function trash(guid: string) {
    const article = byGuid.get(guid);
    if (!article || pending[guid]) return;
    const idx = order.indexOf(guid);
    setOrder((o) => o.filter((g) => g !== guid)); // card has already animated out
    clearKept(guid);
    const points = await postSwipe({ action: "swipe", direction: "left", article: payload(sport, article) });
    if (points == null) {
      reinsert(guid, idx);
      showToast("Couldn't save — try again", () => {});
      return;
    }
    showToast("Removed", () => {
      reinsert(guid, idx);
      void postSwipe({ action: "undo", guid });
    });
  }

  if (order.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 pb-16">
        <div className="rounded-theme border-theme border-ink/10 bg-surface p-10 text-center shadow-theme">
          <p className="font-display text-lg font-bold text-ink">You&apos;re all caught up</p>
          <p className="mt-2 text-sm text-ink/60">
            No more {sport.toUpperCase()} stories to sort. Check the Whoosh Feed to see what the
            community kept, or pick another sport.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-16">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-ink/40">
        Swipe right to keep · left to trash
      </p>
      <div className="grid gap-3">
        {order.map((guid) => {
          const article = byGuid.get(guid);
          if (!article) return null;
          return (
            <SwipeCard
              key={guid}
              article={article}
              keptPoints={guid in kept ? kept[guid] : undefined}
              pending={!!pending[guid]}
              onKeep={() => keep(guid)}
              onTrash={() => trash(guid)}
              onUndoKeep={() => undoKeep(guid)}
            />
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

type CardProps = {
  article: Article;
  /** undefined = idle; null = kept (count unknown); number = kept with point total. */
  keptPoints: number | null | undefined;
  pending: boolean;
  onKeep: () => void;
  onTrash: () => void;
  onUndoKeep: () => void;
};

function SwipeCard({ article, keptPoints, pending, onKeep, onTrash, onUndoKeep }: CardProps) {
  const isKept = keptPoints !== undefined;
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const startX = useRef(0);
  const liveDx = useRef(0);
  const moved = useRef(0);
  const active = useRef(false);

  const date = formatArticleDate(article.pubDate);
  const byline = [article.author, date].filter(Boolean).join(" · ");
  const hero = article.images[0] ?? null;

  function commitTrash() {
    setExiting(true);
    window.setTimeout(onTrash, 220);
  }

  // Drag is disabled once a card is kept (it's decided; undo via toast/button).
  const draggable = !isKept && !exiting && !pending;

  function onPointerDown(e: React.PointerEvent) {
    if (!draggable) return;
    if ((e.target as HTMLElement).closest("button")) return; // not from action buttons
    active.current = true;
    startX.current = e.clientX;
    liveDx.current = 0;
    moved.current = 0;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!active.current) return;
    const dx = e.clientX - startX.current;
    liveDx.current = dx;
    moved.current = Math.max(moved.current, Math.abs(dx));
    setDragX(dx);
  }
  function onPointerUp() {
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    const dx = liveDx.current;
    if (dx > THRESHOLD) {
      setDragX(0);
      onKeep();
    } else if (dx < -THRESHOLD) {
      commitTrash();
    } else {
      setDragX(0);
    }
  }

  // Suppress the outbound link click if the gesture was a drag.
  function onLinkClick(e: React.MouseEvent) {
    if (moved.current > SLOP) e.preventDefault();
  }

  const dir = dragX > 0 ? "right" : dragX < 0 ? "left" : null;
  const revealOpacity = Math.min(1, Math.abs(dragX) / THRESHOLD);

  return (
    <div className="relative overflow-hidden rounded-theme">
      {/* Swipe-direction underlay revealed as the card is dragged. */}
      {dir && !isKept && (
        <div
          className={`absolute inset-0 flex items-center rounded-theme ${
            dir === "right" ? "justify-start bg-pigment-green pl-6" : "justify-end bg-imperial-red pr-6"
          }`}
          style={{ opacity: revealOpacity }}
          aria-hidden="true"
        >
          <span className="font-display text-sm font-black uppercase tracking-wide text-white">
            {dir === "right" ? "Keep ✓" : "Trash ✕"}
          </span>
        </div>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: exiting ? "translateX(-120%)" : `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.22s ease, opacity 0.22s ease",
          opacity: exiting ? 0 : 1,
          touchAction: "pan-y",
        }}
        className={`relative rounded-theme border-theme shadow-theme ${
          isKept ? "border-pigment-green/40 bg-pigment-green/10" : "border-ink/10 bg-surface"
        }`}
      >
        <div className="p-5">
          <header className="flex items-center gap-3">
            <EspnLogo />
            <div className="min-w-0 leading-tight">
              <p className="font-display text-sm font-bold text-ink">ESPN</p>
              {byline && <p className="truncate text-xs text-ink/55">{byline}</p>}
            </div>
            {isKept && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-pigment-green px-3 py-1 text-xs font-bold text-white">
                <CheckIcon className="h-3.5 w-3.5" />
                Kept{typeof keptPoints === "number" ? ` · ${keptPoints}` : ""}
              </span>
            )}
          </header>

          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onLinkClick}
            className="group mt-3 block"
            draggable={false}
          >
            <h2 className="font-display text-lg font-bold leading-snug text-ink group-hover:underline">
              {article.title}
            </h2>
            {article.description && (
              <p className="mt-2 text-sm text-ink/70">{article.description}</p>
            )}
          </a>
        </div>

        {hero && (
          <a href={article.link} target="_blank" rel="noopener noreferrer" onClick={onLinkClick} draggable={false}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero}
              alt=""
              loading="lazy"
              draggable={false}
              className="w-full border-t border-ink/10 object-cover"
            />
          </a>
        )}

        {/* Actions — drag alternative for desktop / keyboard. */}
        <div className="flex items-stretch border-t border-ink/10">
          {isKept ? (
            <button
              type="button"
              onClick={onUndoKeep}
              disabled={pending}
              className="flex-1 py-3 text-sm font-bold text-ink/60 transition-colors hover:bg-ink/5 disabled:opacity-50"
            >
              Undo keep
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={commitTrash}
                disabled={pending}
                className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-bold text-imperial-red transition-colors hover:bg-imperial-red/10 disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4" />
                Trash
              </button>
              <span className="w-px bg-ink/10" aria-hidden="true" />
              <button
                type="button"
                onClick={onKeep}
                disabled={pending}
                className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-bold text-pigment-green transition-colors hover:bg-pigment-green/10 disabled:opacity-50"
              >
                <CheckIcon className="h-4 w-4" />
                Keep
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}
