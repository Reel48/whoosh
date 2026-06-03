import { NextResponse } from "next/server";
import { clearLink, setLink } from "@/lib/fantasy/link";
import { jsonError, jsonOk, readJson, requireBearerSession, respondResult } from "@/lib/api/json";
import type { LinkSleeperRequest, LinkSleeperResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Link or unlink a Sleeper account. Keyed on `session.id` (the app user id — the
 * `discordUserId` param name in `link.ts` is legacy post-auth-migration).
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const body = await readJson<LinkSleeperRequest>(req);
  if (!body) return jsonError("validation", "Request body must be valid JSON.");

  if (body.action === "unlink") {
    await clearLink(session.id).catch(() => {});
    return jsonOk<LinkSleeperResponse>({ link: null });
  }

  const username = String(body.username ?? "").trim();
  if (!username) return jsonError("validation", "Sleeper username is required.");

  const result = await setLink(session.id, username);
  return respondResult<{ link: LinkSleeperResponse["link"] }, LinkSleeperResponse>(
    result,
    (r) => ({ link: r.link }),
  );
}
