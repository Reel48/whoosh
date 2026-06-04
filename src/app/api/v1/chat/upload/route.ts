import { NextResponse } from "next/server";
import { uploadChatImage, uploadChatFile, CHAT_FILE_MIME_TYPES } from "@/lib/chat/chat";
import { jsonError, jsonOk, requireBearerSession } from "@/lib/api/json";
import { requireCapability } from "@/lib/api/client";
import type { ChatUploadResponse } from "@/lib/api/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8_000_000;   // 8 MB
const MAX_FILE_BYTES = 25_000_000;   // 25 MB for documents

/** Upload a chat attachment (multipart `file`) → a public URL the client sends
 *  with the message. Images go to `chat-images`; allow-listed document types go
 *  to `chat-files`. Everything else (executables/scripts/unknown) is rejected. */
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
  if (!(file instanceof File) || file.size === 0) return jsonError("validation", "Choose a file.");

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const isImage = file.type.startsWith("image/");
  const isDoc = CHAT_FILE_MIME_TYPES.has(file.type);
  if (!isImage && !isDoc) return jsonError("validation", "Unsupported file type.");
  if (file.size > (isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES)) {
    return jsonError("validation", isImage ? "Image must be under 8 MB." : "File must be under 25 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const url = isImage
      ? await uploadChatImage(session.id, bytes, file.type, ext || "jpg")
      : await uploadChatFile(session.id, bytes, file.type, ext || "bin");
    return jsonOk<ChatUploadResponse>({ url });
  } catch (e) {
    return jsonError("internal", e instanceof Error ? e.message : "Upload failed.");
  }
}
