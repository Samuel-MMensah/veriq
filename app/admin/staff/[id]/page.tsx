import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountActions } from "@/components/admin/AccountActions";
import { AdminHistory, accountStatus } from "@/components/admin/AdminBits";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { LinkForm } from "@/components/admin/StaffForms";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { historyFor } from "@/lib/admin/log";
import { facilityOptions, listStaff } from "@/lib/admin/staff";
import { staffGate } from "@/lib/auth/session";
import { adminMayAct } from "@/lib/auth/staff";
import { listInsurers } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import type { SearchParams } from "@/lib/view/catalog";
import { whenText } from "@/lib/view/when";
import { linkAccountAction } from "../../actions";

export const metadata: Metadata = { title: "Staff account" };

const ROLE = { admin: "Veriq admin", hospital: "Hospital staff", insurer: "Insurer staff" } as const;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function StaffAccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const path = `/admin/staff/${id}`;
  const gate = await staffGate("admin", path);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Staff account" path={path} />;
  const { staff } = gate;
  const db = await serviceDb();
  const now = new Date();
  const account = (await listStaff(db)).find((p) => p.user_id === id);
  if (!account) notFound();
  const canEdit = adminMayAct(staff, "accounts");
  const isSelf = account.user_id === staff.userId;
  const [history, options] = await Promise.all([
    historyFor(db, { profile_id: id }),
    account.role === "hospital" ? facilityOptions(db) : account.role === "insurer" ? listInsurers(db).then((l) => l.map((i) => ({ id: i.id, label: i.name }))) : [],
  ]);
  const done = first((await searchParams).done);

  return (
    <>
      <AdminPageHeader
        title={account.display_name ?? account.email ?? "Staff account"}
        description={`${ROLE[account.role]}${account.linkedTo ? ` at ${account.linkedTo}` : ""}`}
        action={<Button href="/admin/staff" variant="secondary">All accounts</Button>}
      />
      <AdminBody>
        {done === "off" && <Toast>The account is switched off. It can&apos;t sign in, and its sessions have ended.</Toast>}
        {done === "on" && <Toast>The account is switched back on.</Toast>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-6">
          <div className="space-y-4">
            <Card title="Account" titleId="account" aside={accountStatus(account)}>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Fact label="Email">{account.email}</Fact>
                <Fact label="Role">{ROLE[account.role]}</Fact>
                <Fact label="Made">{whenText(account.created_at, now)}</Fact>
                {account.disabled_at && <Fact label="Switched off">{whenText(account.disabled_at, now)}</Fact>}
              </dl>
            </Card>
            {canEdit && (account.role === "hospital" || account.role === "insurer") && (
              <Card title="Link" titleId="link-title">
                <LinkForm action={linkAccountAction} userId={id} role={account.role} current={account.facility_id ?? account.insurer_id} options={options} />
              </Card>
            )}
            <Card title="History" titleId="history">
              <AdminHistory actions={history} now={now} />
            </Card>
          </div>
          {canEdit && (
            <Card title="Actions" titleId="actions">
              <AccountActions userId={id} email={account.email ?? ""} disabled={Boolean(account.disabled_at)} isSelf={isSelf} />
            </Card>
          )}
        </div>
      </AdminBody>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-semibold break-words">{children}</dd>
    </div>
  );
}
