import type { Metadata } from "next";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { SourceLine } from "@/components/ui/SourceLine";
import { listHospitalClaims, type HospitalClaim } from "@/lib/admin/verify";
import { staffGate } from "@/lib/auth/session";
import { serviceDb } from "@/lib/db/server";
import { isDemoMode } from "@/lib/demo/mode";
import type { SearchParams } from "@/lib/view/catalog";
import { displayName, displayPlace } from "@/lib/view/names";
import { whenText } from "@/lib/view/when";

export const metadata: Metadata = { title: "Hospitals" };

const PATH = "/admin/hospitals";

// Prompt 10: hospitals with staff accounts. Waiting ones need an admin's checks before their staff
// can publish anything.
export default async function HospitalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Hospitals" path={PATH} />;
  const demo = await isDemoMode(await searchParams);
  const { waiting, verified } = await listHospitalClaims(await serviceDb(), demo ? "demo" : "nhia");
  const now = new Date();

  const row = (c: HospitalClaim) => (
    <li key={c.facility.id}>
      <ListRow
        href={`${PATH}/${c.facility.id}`}
        title={displayName(c.facility.name)}
        detail={[c.facility.nhia_type, displayPlace(c.facility.area) ?? displayPlace(c.facility.district)].filter(Boolean).join(" · ")}
        meta={
          c.facility.verified && c.facility.verified_at
            ? `Verified ${whenText(c.facility.verified_at, now)}`
            : `Claimed by ${c.staff.map((s) => s.email).join(", ")} · ${whenText(c.staff[0]!.created_at, now)}`
        }
        trailing={c.facility.verified ? <Badge tone="good">Verified</Badge> : <Badge tone="warn">Waiting</Badge>}
      />
    </li>
  );

  return (
    <>
      <AdminPageHeader
        title="Hospitals"
        description="Check each claim before the hospital can publish."
        action={demo ? <SampleDataTag /> : undefined}
      />
      <AdminBody>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
          <Card title={`Waiting for verification (${waiting.length})`} titleId="waiting" divided>
            {waiting.length === 0 ? (
              <EmptyState title="Nothing waiting" compact>New hospital accounts show here.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">{waiting.map(row)}</ul>
            )}
            <SourceLine className="mt-3">Oldest claim first · from staff accounts, as of {whenText(now.toISOString(), now)}</SourceLine>
          </Card>
          <Card title={`Verified (${verified.length})`} titleId="verified" divided>
            {verified.length === 0 ? <EmptyState icon="shield" title="None yet" compact /> : <ul className="divide-y divide-line">{verified.map(row)}</ul>}
          </Card>
        </div>
      </AdminBody>
    </>
  );
}
