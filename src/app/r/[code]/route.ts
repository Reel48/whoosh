import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "whoosh_ref";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalized = (code ?? "").toUpperCase().slice(0, 16);
  if (!normalized) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  const jar = await cookies();
  // 30-day attribution window.
  jar.set(COOKIE, normalized, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.redirect(new URL("/?ref=ok", req.url), 303);
}
