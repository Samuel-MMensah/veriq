import type { Metadata } from "next";
import Link from "next/link";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmAction } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { SourceLine } from "@/components/ui/SourceLine";
import { Toast } from "@/components/ui/Toast";
import { listHeldReports, type HeldReport } from "@/lib/admin/reports";
import { staffGate } from "@/lib/auth/session";
import { listInsurers, listServices } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import { isDemoMode } from "@/lib/demo/mode";
import type { SearchParams } from "@/lib/view/catalog";
import { displayName } from "@/lib/view/names";
import { whenText } from "@/lib/view/when";
import { reviewReportAction } from "../actions";

export const metadata: Metadata = { title: "Held reports" };

const PATH = "/admin/reports";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ITEM = { scan: "a scan", drugs: "drugs", lab: "a lab test", registration: "registration" } as const;

function outcomeText(r: HeldReport): { text: string; tone: "good" | "warn" | "neutral" } {
  if (r.outcome === "covered") return { text: "Card worked", tone: "good" };
  if (r.outcome === "refused") return { text: "Card refused", tone: "warn" };
  const amount = r.amount_ghs !== null ? `GH¢ ${r.amount_ghs}` : "extra";
  return { text: `Paid ${amount}${r.item ? ` for ${ITEM[r.item]}` : ""}`, tone: "neutral" };
}

// Rule A: more than 10 reports for one hospital in an hour are held. Release or reject each.
export default async function HeldReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Held reports" path={PATH} />;
  const sp = await searchParams;
  const demo = await isDemoMode(sp);
  const db = await serviceDb();
  const [held, insurers, services] = await Promise.all([listHeldReports(db, demo ? "demo" : "nhia"), listInsurers(db), listServices(db)]);
  const card = new Map(insurers.map((i) => [i.id, i.name]));
  const service = new Map(services.map((s) => [s.id, s.name]));
  const now = new Date();
  const done = first(sp.done);

  return (
    <>
      <AdminPageHeader
        title="Held reports"
        description="Held by the burst rule. Release or reject each one."
        action={demo && held.length > 0 ? <SampleDataTag /> : undefined}
      />
      <AdminBody>
        {done === "released" && <Toast>Released. The report counts from now on.</Toast>}
        {done === "rejected" && <Toast>Rejected. The report will never count.</Toast>}
        {held.length === 0 ? (
          <Card>
            <EmptyState title="No held reports">Nothing is waiting. Reports are held only when a hospital gets more than 10 in an hour.</EmptyState>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            {held.map((r) => {
              const o = outcomeText(r);
              return (
                <Card as="li" key={r.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/admin/hospitals/${r.facility_id}`} className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline">
                        {displayName(r.facilityName)}
                      </Link>
                      <p className="text-muted">
                        {card.get(r.insurer_id) ?? "Card"}
                        {r.service_id && <> · {service.get(r.service_id) ?? r.service_id}</>}
                      </p>
                    </div>
                    <Badge tone={o.tone}>{o.text}</Badge>
                  </div>
                  <SourceLine className="mt-3">Patient report, {whenText(r.created_at, now)} · held by the burst rule</SourceLine>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <ConfirmAction
                      action={reviewReportAction}
                      fields={{ report: r.id, decision: "release" }}
                      label="Release"
                      title="Release this report?"
                      body="It becomes a live report and counts toward the hospital's badge from now on."
                      confirmLabel="Release"
                      triggerVariant="secondary"
                      reason={{ label: "Why?", hint: "e.g. \"Busy clinic day, reports look real\".", required: true }}
                    />
                    <ConfirmAction
                      action={reviewReportAction}
                      fields={{ report: r.id, decision: "reject" }}
                      label="Reject"
                      title="Reject this report?"
                      body="It will never count. This can't be undone."
                      confirmLabel="Reject"
                      variant="primary"
                      reason={{ label: "Why?", hint: "e.g. \"Same pattern as a burst of fake reports\".", required: true }}
                    />
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
        <SourceLine>Oldest first · patient reports · {whenText(now.toISOString(), now)}</SourceLine>
      </AdminBody>
    </>
  );
}
