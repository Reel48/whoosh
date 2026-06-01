/**
 * Site-wide date/time formatting. Every user-facing time is displayed in U.S.
 * Central time (America/Chicago, which is CST in winter / CDT in summer — i.e.
 * the correct Central wall-clock time year-round), regardless of where the code
 * runs (the server is UTC) or where the viewer is.
 */

export const DISPLAY_TZ = "America/Chicago";

/**
 * Format a timestamp (ISO string, epoch ms, or Date) in Central time. Pass the
 * Intl options for the fields you want; the time zone is always Central.
 */
export function formatCentral(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Date(value).toLocaleString("en-US", { ...options, timeZone: DISPLAY_TZ });
}
