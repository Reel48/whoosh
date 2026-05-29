"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Item = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

const KIND_ICON: Record<string, string> = {
  bet_settled: "🎰",
  dividend: "💰",
  transfer_in: "📥",
  interest_posted: "💸",
  achievement: "🏆",
  renewal: "🔁",
  referral: "🤝",
  system: "📣",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const r = await fetch("/api/wb/notifications");
      if (!r.ok) return;
      const j = (await r.json()) as { items: Item[]; unread: number };
      setItems(j.items);
      setUnread(j.unread);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function onOpen() {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      // mark all read on open
      await fetch("/api/wb/notifications", { method: "POST" });
      setUnread(0);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        onClick={onOpen}
        className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-white-smoke transition-colors hover:bg-ink hover:text-white-smoke"
      >
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-ink bg-ink px-1 text-[10px] font-black text-white-smoke">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        // On mobile: pin to the viewport (fixed) and span left-2..right-2 so the
        // dropdown never clips offscreen no matter where the bell sits in the nav.
        // On sm+: anchor to the bell with `absolute right-0`.
        <div className="fixed left-2 right-2 top-[60px] z-40 mt-0 max-h-[80vh] overflow-hidden rounded-2xl border-2 border-ink bg-white-smoke shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:max-h-none">
          <div className="flex items-baseline justify-between border-b-2 border-ink px-4 py-3">
            <p className="font-heading font-bold text-ink">Notifications</p>
            {loading && <span className="text-xs text-ink/60">refreshing…</span>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink/60">
              No notifications yet. We&rsquo;ll ping you on bet settlements,
              dividends, transfers, and renewals.
            </p>
          ) : (
            <ul className="max-h-[calc(80vh-56px)] divide-y-2 divide-ink/10 overflow-y-auto sm:max-h-96">
              {items.map((it) => {
                const inner = (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="text-lg" aria-hidden="true">
                      {KIND_ICON[it.kind] ?? "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-heading font-bold text-ink">
                        {it.title}
                      </p>
                      {it.body && (
                        <p className="mt-0.5 text-xs text-ink/60 line-clamp-2">{it.body}</p>
                      )}
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-ink/40">
                        {timeAgo(it.createdAt)} ago
                      </p>
                    </div>
                    {!it.readAt && (
                      <span
                        aria-hidden="true"
                        className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-ink"
                      />
                    )}
                  </div>
                );
                return (
                  <li key={it.id}>
                    {it.href ? (
                      <Link
                        href={it.href}
                        onClick={() => setOpen(false)}
                        className="block hover:bg-ink/5"
                      >
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
