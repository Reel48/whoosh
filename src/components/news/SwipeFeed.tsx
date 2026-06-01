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
 * The swipeable sport feed. Drag a card right to keep it (records +1 point) or
 * left to trash it; either way the card leaves the feed — a keep means "read it,
 * decided." Writes are optimistic with a background POST and an Undo toast. Kept
 * articles resurface in the Whoosh Feed and My Keeps.
 */
export function SwipeFeed({ sport, articles }: Props) {
  const byGuid = new Map(articles.map((a) => [a.guid, a]));
  const [order, setOrder] = useState<string[]>(() => articles.map((a) => a.guid));
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

  async function commit(guid: string, direction: "left" | "right") {
    const article = byGuid.get(guid);
    if (!article) return;
    const idx = order.indexOf(guid);
    setOrder((o) => o.filter((g) => g !== guid)); // card has already animated out
    const points = await postSwipe({ action: "swipe", direction, article: payload(sport, article) });
    if (points == null) {
      reinsert(guid, idx);
      showToast("Couldn't save — try again", () => {});
      return;
    }
    showToast(direction === "right" ? "Boosted · +1 point" : "Removed", () => {
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
            community boosted, or pick another sport.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-16">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-ink/40">
        Swipe right to boost · left to trash
      </p>
      <div className="grid gap-3">
        {order.map((guid) => {
          const article = byGuid.get(guid);
          if (!article) return null;
          return (
            <SwipeCard
              key={guid}
              article={article}
              onKeep={() => commit(guid, "right")}
              onTrash={() => commit(guid, "left")}
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
  onKeep: () => void;
  onTrash: () => void;
};

function SwipeCard({ article, onKeep, onTrash }: CardProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const startX = useRef(0);
  const liveDx = useRef(0);
  const moved = useRef(0);
  const active = useRef(false);

  const date = formatArticleDate(article.pubDate);
  const byline = [article.author, date].filter(Boolean).join(" · ");
  const hero = article.images[0] ?? null;

  function commit(direction: "left" | "right") {
    setExitDir(direction);
    window.setTimeout(direction === "right" ? onKeep : onTrash, 220);
  }

  const draggable = !exitDir;

  function onPointerDown(e: React.PointerEvent) {
    if (!draggable) return;
    active.current = true;
    startX.current = e.clientX;
    liveDx.current = 0;
    moved.current = 0;
    setDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture can throw for synthetic/stale pointers — harmless. */
    }
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
      commit("right");
    } else if (dx < -THRESHOLD) {
      commit("left");
    } else {
      setDragX(0);
    }
  }

  // Suppress the outbound link click if the gesture was a drag.
  function onLinkClick(e: React.MouseEvent) {
    if (moved.current > SLOP) e.preventDefault();
  }

  const dir = exitDir ?? (dragX > 0 ? "right" : dragX < 0 ? "left" : null);
  const revealOpacity = exitDir ? 1 : Math.min(1, Math.abs(dragX) / THRESHOLD);
  const transform =
    exitDir === "right"
      ? "translateX(120%)"
      : exitDir === "left"
        ? "translateX(-120%)"
        : `translateX(${dragX}px)`;

  return (
    <div className="relative overflow-hidden rounded-theme">
      {/* Swipe-direction underlay revealed as the card is dragged / exits. */}
      {dir && (
        <div
          className={`absolute inset-0 flex items-center rounded-theme ${
            dir === "right" ? "justify-start bg-pigment-green pl-6" : "justify-end bg-imperial-red pr-6"
          }`}
          style={{ opacity: revealOpacity }}
          aria-hidden="true"
        >
          <span className="font-display text-sm font-black uppercase tracking-wide text-white">
            {dir === "right" ? "Boost ✓" : "Trash ✕"}
          </span>
        </div>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform,
          transition: dragging ? "none" : "transform 0.22s ease, opacity 0.22s ease",
          opacity: exitDir ? 0 : 1,
          touchAction: "pan-y",
        }}
        className="relative rounded-theme border-theme border-ink/10 bg-surface shadow-theme"
      >
        <div className="p-5">
          <header className="flex items-center gap-3">
            <EspnLogo />
            <div className="min-w-0 leading-tight">
              <p className="font-display text-sm font-bold text-ink">ESPN</p>
              {byline && <p className="truncate text-xs text-ink/55">{byline}</p>}
            </div>
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
      </div>
    </div>
  );
}
