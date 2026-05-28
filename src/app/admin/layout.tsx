import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasAdminRole } from "@/lib/discord";
import { Nav } from "@/components/Nav";
import { AdminSubNav } from "@/components/AdminSubNav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — Whoosh",
};

/**
 * Gates every /admin/* route:
 *   1. Not signed in → bounce through Discord OAuth back to /admin.
 *   2. Signed in but not an admin → 404 (don't advertise the portal exists).
 *   3. Admin → render the page with the admin sub-nav.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/api/auth/discord?next=/admin");
  }

  const isAdmin = await hasAdminRole(session.id).catch(() => false);
  if (!isAdmin) {
    notFound();
  }

  return (
    <>
      <Nav />
      <AdminSubNav />
      {children}
    </>
  );
}
