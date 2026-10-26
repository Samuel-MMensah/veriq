import type { Metadata } from "next";
import Link from "next/link";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { CreateAccountForm } from "@/components/admin/StaffForms";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { accountStatus } from "@/components/admin/AdminBits";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { SourceLine } from "@/components/ui/SourceLine";
import { facilityOptions, listStaff } from "@/lib/admin/staff";
import { staffGate } from "@/lib/auth/session";
import { adminMayAct } from "@/lib/auth/staff";
import { listInsurers } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import { whenText } from "@/lib/view/when";
import { createAccountAction } from "../actions";

export const metadata: Metadata = { title: "Staff accounts" };

const PATH = "/admin/staff";
const ROLE = { admin: "Veriq admin", hospital: "Hospital", insurer: "Insurer" } as const;

// Staff accounts (Prompt 10): made by an admin, never by email or SMS.
export default async function StaffPage() {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Staff accounts" path={PATH} />;
  const { staff } = gate;
  const db = await serviceDb();
  const now = new Date();
  const canEdit = adminMayAct(staff, "accounts");
  const [list, facilities, insurers] = await Promise.all([listStaff(db), canEdit ? facilityOptions(db) : [], listInsurers(db)]);

  return (
    <>
      <AdminPageHeader title="Staff accounts" description="Hospital, insurer and admin accounts. You make them here and hand over a one-time password yourself." />
      <AdminBody>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-6">
          <Card title={`Accounts (${list.length})`} titleId="accounts">
            {list.length === 0 ? (
              <EmptyState icon="people" title="No staff accounts yet" />
            ) : (
              <>
                <ul className="divide-y divide-line lg:hidden">
                  {list.map((p) => (
                    <li key={p.user_id}>
                      <ListRow
                        href={`/admin/staff/${p.user_id}`}
                        title={p.display_name ?? p.email}
                        detail={[ROLE[p.role], p.linkedTo].filter(Boolean).join(" · ")}
                        meta={p.email}
                        trailing={accountStatus(p)}
                      />
                    </li>
                  ))}
                </ul>
                <table className="hidden w-full text-left lg:table">
                  <thead className="text-sm text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3 font-semibold">Person</th>
                      <th className="py-2 pr-3 font-semibold">Role</th>
                      <th className="py-2 pr-3 font-semibold">Linked to</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 font-semibold">Made</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {list.map((p) => (
                      <tr key={p.user_id} className="hover:bg-brand-soft/40">
                        <td className="py-3 pr-3">
                          <Link href={`/admin/staff/${p.user_id}`} className="inline-flex min-h-11 flex-col justify-center font-semibold text-brand hover:underline">
                            {p.display_name ?? p.email}
                            <span className="text-sm font-normal text-muted">{p.email}</span>
                          </Link>
                        </td>
                        <td className="py-3 pr-3">{ROLE[p.role]}</td>
                        <td className="py-3 pr-3">{p.linkedTo ?? "—"}</td>
                        <td className="py-3 pr-3">{accountStatus(p)}</td>
                        <td className="py-3 text-sm text-muted">{whenText(p.created_at, now)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <SourceLine className="mt-3">From Veriq&apos;s staff profiles, as of {whenText(now.toISOString(), now)}</SourceLine>
          </Card>

          <Card title="New account" titleId="new-account">
            {canEdit ? (
              <CreateAccountForm
                action={createAccountAction}
                facilities={facilities}
                insurers={insurers.map((i) => ({ id: i.id, label: i.name }))}
              />
            ) : (
              <p className="text-muted">The demo login can&apos;t make real accounts. Sign in with your admin account.</p>
            )}
          </Card>
        </div>
      </AdminBody>
    </>
  );
}
