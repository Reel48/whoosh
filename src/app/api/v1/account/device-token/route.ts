import { NextResponse } from "next/server";
import { registerDeviceToken } from "@/lib/push/tokens";
import { jsonOk, jsonError, readJson, requireBearerSession } from "@/lib/api/json";
import type { DeviceTokenRequest, DeviceTokenResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Register this device's APNs token for push notifications. */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const body = await readJson<DeviceTokenRequest>(req);
  if (!body?.token) return jsonError("validation", "token required.");
  try {
    await registerDeviceToken(session.id, body.token, body.platform ?? "ios");
    return jsonOk<DeviceTokenResponse>({ ok: true });
  } catch {
    return jsonError("internal", "Could not register device token.");
  }
}
