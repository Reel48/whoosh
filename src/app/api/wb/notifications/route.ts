import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listNotifications, markAllRead, countUnread } from "@/lib/wb/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ items: [], unread: 0 });
  const [items, unread] = await Promise.all([
    listNotifications(session.id, 15).catch(() => []),
    countUnread(session.id).catch(() => 0),
  ]);
  return NextResponse.json({ items, unread });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  await markAllRead(session.id).catch(() => {});
  return NextResponse.json({ ok: true });
}
