import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHistory, accountStatus } from "@/components/admin/AdminBits";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { VerifyForm } from "@/components/admin/VerifyForm";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmAction } from "@/components/ui/Dialog";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { SourceLine } from "@/components/ui/SourceLine";
import { Toast } from "@/components/ui/Toast";
import { historyFor, loadFacility } from "@/lib/admin/log";
import { staffGate } from "@/lib/auth/session";
import { adminMayAct } from "@/lib/auth/staff";
import { serviceDb } from "@/lib/db/server";
import type { ProfileRow } from "@/lib/db/types";
import { sourceLine } from "@/lib/rules/directory";
import type { SearchParams } from "@/lib/view/catalog";
import { displayName, displayPlace } from "@/lib/view/names";
import { whenText } from "@/lib/view/when";
import { unverifyAction, verifyAction } from "../../actions";

export const metadata: Metadata = { title: "Verify a hospital" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Prompt 10: one hospital's claim, the checks, and its admin history.
export default async function HospitalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const path = `/admin/hospitals/${id}`;
  const gate = await staffGate("admin", path);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Hospital" path={path} />;
  const { staff } = gate;
  const db = await serviceDb();
  const facility = await loadFacility(db, id);
  if (!facility) notFound();
  const now = new Date();
  const [history, { data: profiles }] = await Promise.all([
    historyFor(db, { facility_id: id }),
    db.from("profiles").select("*").eq("facility_id", id).order("created_at"),
  ]);
  const claimants = (profiles ?? []) as ProfileRow[];
  const verifier = history.find((a) => a.action === "verify_hospital");
  const canEdit = adminMayAct(staff, facility);
  const done = first((await searchParams).done);
  const name = displayName(facility.name);

  return (
    <>
      <AdminPageHeader
        title={name}
        description={[facility.nhia_type, displayPlace(facility.area), displayPlace(facility.district)].filter(Boolean).join(" · ")}
        action={
          <div className="flex items-center gap-2">
            {facility.source === "demo" && <SampleDataTag />}
            <Button href="/admin/hospitals" variant="secondary">
              All hospitals
            </Button>
          </div>
        }
      />
      <AdminBody>
        {done === "verified" && <Toast>{name} is verified. Its staff can publish the morning check now.</Toast>}
        {done === "unverified" && <Toast>Verification removed. Its staff can no longer publish.</Toast>}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_26rem] lg:items-start lg:gap-6">
          <div className="space-y-4">
            <Card
              title="Status"
              titleId="status"
              aside={facility.verified ? <Badge tone="good">Verified</Badge> : <Badge tone="warn">Waiting for verification</Badge>}
            >
              {facility.verified && facility.verified_at ? (
                <p>
                  Verified by <strong>{verifier?.actor_label ?? "an admin"}</strong>, {whenText(facility.verified_at, now)}.
                </p>
              ) : (
                <p className="text-muted">Its staff can sign in and look, but can&apos;t publish anything until you verify it.</p>
              )}
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted">Name on the list</dt>
                  <dd className="font-semibold">{facility.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Where in the NHIA file</dt>
                  <dd className="font-semibold break-all">{facility.source_ref ?? "Not in the file"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Phone on the list</dt>
                  <dd className="font-semibold">{facility.phone ?? "None. Find one yourself."}</dd>
                </div>
              </dl>
              <SourceLine className="mt-3">{sourceLine(facility) ?? "Invented demo hospital (sample data)"}</SourceLine>
            </Card>

            <Card title={`Staff accounts (${claimants.length})`} titleId="claimants">
              <ul className="divide-y divide-line">
                {claimants.map((p) => (
                  <li key={p.user_id} className="flex min-h-14 items-center justify-between gap-3 py-3">
                    <Link href={`/admin/staff/${p.user_id}`} className="min-w-0 font-semibold text-brand hover:underline">
                      <span className="block truncate">{p.display_name ?? p.email}</span>
                      <span className="block truncate text-sm font-normal text-muted">
                        {p.email} · made {whenText(p.created_at, now)}
                      </span>
                    </Link>
                    {accountStatus(p)}
                  </li>
                ))}
                {claimants.length === 0 && <li className="py-3 text-muted">No staff accounts for this hospital.</li>}
              </ul>
            </Card>

            <Card title="History" titleId="history">
              <AdminHistory actions={history} now={now} />
            </Card>
          </div>

          {canEdit && (
            <Card title={facility.verified ? "Verification" : "Verify this hospital"} titleId="verify">
              {facility.verified ? (
                <ConfirmAction
                  action={unverifyAction}
                  fields={{ facility: id }}
                  label="Remove verification"
                  title="Remove verification?"
                  body={<>{name}&apos;s staff can no longer publish a morning check or answers. What they published stays, with its time.</>}
                  confirmLabel="Remove verification"
                  variant="danger"
                  reason={{ label: "Why?", hint: "Required, for the admin log.", required: true }}
                />
              ) : (
                <VerifyForm action={verifyAction} facilityId={id} nhiaName={facility.name} nhiaRef={facility.source_ref} />
              )}
            </Card>
          )}
        </div>
      </AdminBody>
    </>
  );
}
