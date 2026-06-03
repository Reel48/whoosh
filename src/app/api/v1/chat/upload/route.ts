import { NextResponse } from "next/server";
import { uploadChatImage } from "@/lib/chat/chat";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { ChatUploadResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8_000_000; // 8 MB

/** Upload a chat image (multipart `file`) → public `chat-images` URL the client
 *  then sends as a message's imageUrl. */
export async function POST(req: Request) {
  const session = await requireBearerSession(req);
  if (session instanceof NextResponse) return session;
  const gate = requireCapability(req, "chat");
  if (gate) return gate;

  let file: unknown;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return jsonError("validation", "Expected multipart/form-data with a `file` field.");
  }
  if (!(file instanceof File) || file.size === 0) return jsonError("validation", "Choose an image file.");
  if (!file.type.startsWith("image/")) return jsonError("validation", "File must be an image.");
  if (file.size > MAX_BYTES) return jsonError("validation", "Image must be under 8 MB.");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const url = await uploadChatImage(session.id, bytes, file.type, ext);
    return jsonOk<ChatUploadResponse>({ url });
  } catch (e) {
    return jsonError("internal", e instanceof Error ? e.message : "Upload failed.");
  }
}
