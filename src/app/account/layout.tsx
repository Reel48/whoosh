import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

/**
 * Account is a shared signed-in page reachable from any section (and by
 * signed-in non-premium members), so it gates on session only — not premium —
 * and renders the app chrome with no active section.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord?next=/account");
  return <AppShell>{children}</AppShell>;
}
