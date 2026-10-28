import type { Metadata } from "next";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { SourceLine } from "@/components/ui/SourceLine";
import { Toast } from "@/components/ui/Toast";
import { staffGate } from "@/lib/auth/session";
import { adminMayAct } from "@/lib/auth/staff";
import { cardOrder } from "@/lib/calls/context";
import { ANSWER_TEXT } from "@/lib/calls/input";
import { listCalls } from "@/lib/calls/record";
import { listInsurers } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import type { SearchParams } from "@/lib/view/catalog";
import { displayName } from "@/lib/view/names";
import { whenText } from "@/lib/view/when";

export const metadata: Metadata = { title: "Verification calls" };

const PATH = "/admin/calls";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Prompt 10b: calls by the Veriq team to real facilities, newest first. No patient data.
export default async function CallsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Verification calls" path={PATH} />;
  const sp = await searchParams;
  const db = await serviceDb();
  const now = new Date();
  const [calls, insurers] = await Promise.all([listCalls(db), listInsurers(db)]);
  const cards = cardOrder(insurers);
  const saved = first(sp.saved);
  const savedName = saved ? calls.find((c) => c.facility_id === saved)?.facility?.name : null;
  const canSave = adminMayAct(gate.staff, { source: "nhia" });

  return (
    <>
      <AdminPageHeader
        title="Verification calls"
        description="Our calls to real facilities: what each says about every card."
        action={canSave ? <Button href="/admin/calls/new" icon="plus">Record a call</Button> : undefined}
      />
      <AdminBody>
        {savedName && <Toast>Call saved for {displayName(savedName)}. Its badges, phone and services update now.</Toast>}
        {!canSave && (
          <Card tone="warn">
            <p>Demo login: you can look, not save. Sign in with your admin account to record calls.</p>
          </Card>
        )}
        <div className="flex flex-wrap gap-2">
          <Button href="/admin/calls/summary" variant="secondary">
            What the calls found
          </Button>
          <Button href="/admin/calls/import" variant="secondary">
            Import paper calls
          </Button>
        </div>

        <Card title={`Calls (${calls.length})`} titleId="calls" aside="Newest first" divided>
          {calls.length === 0 ? (
            <EmptyState icon="phone" title="No calls yet" compact>
              Record each call as you make it, or import a paper sheet.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {calls.map((c) => {
                const answered = cards
                  .map((card) => ({ card, a: c.answers.find((a) => a.insurer_id === card.id) }))
                  .filter(({ a }) => a && a.answer !== "not_asked")
                  .map(({ card, a }) => `${card.name}: ${ANSWER_TEXT[a!.answer].toLowerCase()}${a!.note ? ` (${a!.note})` : ""}`);
                return (
                  <li key={c.id}>
                    <ListRow
                      href={`/admin/calls/new?facility=${c.facility_id}`}
                      title={c.facility ? displayName(c.facility.name) : "Unknown facility"}
                      detail={answered.length ? answered.join(" · ") : "No card asked about"}
                      meta={`${whenText(c.called_at, now)} · ${c.answered_role} · ${c.phone_reached} · by ${c.caller_label}${c.entered_via === "csv" ? " · from paper" : ""}`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <SourceLine className="mt-3">From the Veriq call log, which nobody can change or delete · as of {whenText(now.toISOString(), now)}</SourceLine>
        </Card>
      </AdminBody>
    </>
  );
}
