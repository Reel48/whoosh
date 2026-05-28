/**
 * Shared auth for Vercel Cron endpoints.
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` to scheduled routes
 * — set CRON_SECRET in the Vercel project. Returns true if the caller is
 * either the Vercel Cron scheduler or anyone with the secret (for manual
 * triggers via `curl -H "Authorization: Bearer $CRON_SECRET"`).
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
