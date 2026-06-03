import { NextResponse } from "next/server";
import { setAvatar } from "@/lib/profile";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import type { AvatarResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5_000_000; // 5 MB, matching the league-logo upload.

/**
 * Upload a profile avatar. multipart/form-data with a `file` image field →
 * stored in the public `avatars` bucket, URL saved on the profile. The only
 * non-JSON endpoint in the v1 API.
 */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;

  let file: unknown;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return jsonError("validation", "Expected multipart/form-data with a `file` field.");
  }

  if (!(file instanceof File) || file.size === 0) {
    return jsonError("validation", "Choose an image file.");
  }
  if (!file.type.startsWith("image/")) {
    return jsonError("validation", "File must be an image.");
  }
  if (file.size > MAX_BYTES) {
    return jsonError("validation", "Image must be under 5 MB.");
  }

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const avatarUrl = await setAvatar(session.id, bytes, file.type, ext);
    return jsonOk<AvatarResponse>({ avatarUrl });
  } catch (e) {
    return jsonError("internal", e instanceof Error ? e.message : "Avatar upload failed.");
  }
}
