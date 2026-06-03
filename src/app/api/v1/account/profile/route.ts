import { NextResponse } from "next/server";
import { isOnboarded, markOnboarded, setUsername } from "@/lib/profile";
import { jsonError, jsonOk, readJson, requireBearerSession } from "@/lib/api/json";
import type { ProfileResponse, SetUsernameRequest } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Set the user's @handle and mark them onboarded. Drives the first-run "create
 * your profile" step (also reusable for later handle edits). The avatar is
 * uploaded separately via `POST /account/avatar`.
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const body = await readJson<SetUsernameRequest>(req);
  if (!body) return jsonError("validation", "Request body must be valid JSON.");

  const result = await setUsername(session.id, String(body.username ?? ""));
  if (!result.ok) return jsonError(result.code, result.error);

  await markOnboarded(session.id);

  return jsonOk<ProfileResponse>({
    id: session.id,
    username: String(body.username).trim(),
    avatarUrl: session.avatarUrl,
    onboarded: await isOnboarded(session.id),
  });
}
