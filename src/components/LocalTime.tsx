import { formatCentral } from "@/lib/datetime";

const DEFAULT_OPTS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};

/**
 * Render an ISO timestamp in the site's display zone — U.S. Central time
 * (America/Chicago), the same everywhere for every viewer. Deterministic on the
 * server and client, so there's no hydration mismatch. `timeZoneName: "short"`
 * shows the CST/CDT label.
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
  const text = formatCentral(iso, { ...DEFAULT_OPTS, ...options });
  return (
    <time dateTime={iso}>
      {prefix}
      {text}
    </time>
  );
}
