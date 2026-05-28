import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/#plans", req.url), { status: 303 });
}

export const GET = POST;
