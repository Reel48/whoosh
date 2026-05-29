import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setLink, clearLink } from "@/lib/fantasy/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only allow redirects back into our own app, never an open redirect. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/fantasy";
}

function back(req: Request, next: string, params: Record<string, string>): NextResponse {
  const url = new URL(next, req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/api/auth/discord?next=/fantasy", req.url), 303);
  }

  let username = "";
  let next = "/fantasy";
  let action = "link";
  try {
    const form = await req.formData();
    username = String(form.get("username") ?? "").trim();
    next = safeNext(String(form.get("next") ?? "/fantasy"));
    action = String(form.get("action") ?? "link");
  } catch {
    return back(req, "/fantasy", { flink: "error", fmsg: "Could not read the form." });
  }

  if (action === "unlink") {
    await clearLink(session.id).catch(() => {});
    return back(req, next, { flink: "unlinked" });
  }

  const result = await setLink(session.id, username);
  if (!result.ok) {
    return back(req, next, { flink: "error", fmsg: result.error });
  }
  return back(req, next, { flink: "ok" });
}
