import { NextResponse } from "next/server";
import { HANDLE_RE, isHandleAvailable, normalizeHandle } from "@/lib/profile";
import { jsonOk, requireBearerSession } from "@/lib/api/json";
import type { UsernameAvailableResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live handle-availability check for the onboarding UI. */
export async function GET(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  const handle = (new URL(req.url).searchParams.get("handle") ?? "").trim();
  const normalized = normalizeHandle(handle);

  if (!HANDLE_RE.test(handle)) {
    return jsonOk<UsernameAvailableResponse>({
      available: false,
      normalized,
      reason: "Handle must be 3–20 characters: letters, numbers, or underscores.",
    });
  }

  // Exclude the caller's own row so re-confirming their current handle is "available".
  const available = await isHandleAvailable(handle, session.id);
  return jsonOk<UsernameAvailableResponse>({
    available,
    normalized,
    reason: available ? undefined : "That handle is taken.",
  });
}
