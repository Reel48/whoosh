"use client";

import { useEffect, useState } from "react";

const DEFAULT_OPTS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

/**
 * Render an ISO timestamp in the viewer's local time zone.
 *
 * Server components format on the server (UTC on Vercel), which is why game
 * times looked wrong. We can't know the visitor's zone on the server, so the
 * SSR/first-render output is pinned to Central time (America/Chicago) — that's
 * both deterministic (no hydration mismatch) and the desired default. After
 * mount we re-format using the browser's actual zone.
 */
export function LocalTime({
  iso,
  options,
  prefix,
}: {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
  prefix?: string;
}) {
  const opts = { ...DEFAULT_OPTS, ...options };
  const fmt = (timeZone?: string) =>
    new Date(iso).toLocaleString("en-US", timeZone ? { ...opts, timeZone } : opts);

  const [text, setText] = useState(() => fmt("America/Chicago"));
  useEffect(() => {
    setText(fmt(undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {prefix}
      {text}
    </time>
  );
}
