import { StaffBody, StaffPageHeader, StaffShell } from "@/components/staff/StaffShell";
import type { NavItem } from "@/components/staff/StaffNav";
import type { Staff } from "@/lib/auth/staff";

/** The admin pages, in the order of the side bar. */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "home" },
  { href: "/admin/hospitals", label: "Hospitals", icon: "shield" },
  { href: "/admin/calls", label: "Calls", icon: "phone" },
  { href: "/admin/reports", label: "Held reports", icon: "flag" },
  { href: "/admin/locations", label: "Locations", icon: "pin" },
  { href: "/admin/staff", label: "Staff accounts", icon: "people" },
  { href: "/admin/demo", label: "Demo data", icon: "beaker" },
];

/** The admin frame: the same shell as insurers and hospital staff (Prompt 10c). */
export function AdminShell({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  return (
    <StaffShell staff={staff} area="admin" nav={ADMIN_NAV} signOutTo="/admin">
      {children}
    </StaffShell>
  );
}

/** The top of an admin screen: one title, at most one short line, at most one action. */
export const AdminPageHeader = StaffPageHeader;

/** The body of an admin screen. */
export const AdminBody = StaffBody;
