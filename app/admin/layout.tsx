import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { currentStaff } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// The admin frame shows only to a signed-in admin; each page checks again and shows sign-in otherwise.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await currentStaff();
  if (staff?.role !== "admin" || staff.mustChangePassword) return children;
  return <AdminShell staff={staff}>{children}</AdminShell>;
}
