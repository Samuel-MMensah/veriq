import type { Metadata } from "next";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { CallForm } from "@/components/admin/CallForm";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/Field";
import { ListRow } from "@/components/ui/ListRow";
import { SourceLine } from "@/components/ui/SourceLine";
import { matchesSearch } from "@/lib/admin/location";
import { staffGate } from "@/lib/auth/session";
import { adminMayAct } from "@/lib/auth/staff";
import { listRealFacilities, loadCallContext } from "@/lib/calls/context";
import { listCalls } from "@/lib/calls/record";
import { serviceDb } from "@/lib/db/server";
import { sourceLine } from "@/lib/rules/directory";
import type { SearchParams } from "@/lib/view/catalog";
import { displayName, displayPlace } from "@/lib/view/names";
import { whenText } from "@/lib/view/when";
import { recordCallAction } from "../actions";

export const metadata: Metadata = { title: "Record a call" };

const PATH = "/admin/calls/new";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const SHOWN = 20;

// Prompt 10b: find the real facility you called, then record what it said.
export default async function NewCallPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Record a call" path={PATH} />;
  const sp = await searchParams;
  const db = await serviceDb();
  const now = new Date();
  const facilities = await listRealFacilities(db);
  const chosen = facilities.find((f) => f.id === first(sp.facility));
  const canSave = adminMayAct(gate.staff, { source: "nhia" });

  if (!chosen) {
    const q = (first(sp.q) ?? "").trim();
    const matches = q ? facilities.filter((f) => matchesSearch(f, q) || f.source_ref?.toLowerCase() === q.toLowerCase() || f.source_ref?.toLowerCase().endsWith(`#${q.toLowerCase()}`)) : [];
    return (
      <>
        <AdminPageHeader title="Record a call" description="First, find the facility you called." action={<Button href="/admin/calls" variant="secondary">All calls</Button>} />
        <AdminBody>
          <form role="search" className="flex gap-2" action={PATH}>
            <label htmlFor="q" className="sr-only">
              Search by name, district or source row
            </label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name, district or source row" className={`${inputClass()} min-w-0 flex-1`} />
            <Button variant="secondary" icon="search">
              Search
            </Button>
          </form>
          <SourceLine>{facilities[0] ? sourceLine(facilities[0]) : "From the NHIA list"} · {facilities.length} real facilities</SourceLine>
          {q && (
            <Card title={`${matches.length} ${matches.length === 1 ? "match" : "matches"}`} titleId="matches" aside={matches.length > SHOWN ? `First ${SHOWN}` : undefined} divided>
              {matches.length === 0 ? (
                <EmptyState icon="search" title="No facility matches" compact>
                  Try part of the name, the district, or the source row (e.g. row-17).
                </EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {matches.slice(0, SHOWN).map((f) => (
                    <li key={f.id}>
                      <ListRow
                        href={`${PATH}?facility=${f.id}`}
                        title={displayName(f.name)}
                        detail={[f.nhia_type, displayPlace(f.area), displayPlace(f.district)].filter(Boolean).join(" · ")}
                        meta={`NHIA file ${f.source_ref?.split("#")[1]?.replace("-", " ") ?? f.source_ref}${f.phone ? ` · ${f.phone}` : ""}${f.location_source === "none" ? " · no map location" : ""}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </AdminBody>
      </>
    );
  }

  const [{ ctx, insurers, services }, calls] = await Promise.all([loadCallContext(db, now), listCalls(db)]);
  const before = calls.filter((c) => c.facility_id === chosen.id);
  // Accra is GMT all year, so UTC "YYYY-MM-DDTHH:MM" is the local time the form shows.
  const nowLocal = now.toISOString().slice(0, 16);

  return (
    <>
      <AdminPageHeader
        title={displayName(chosen.name)}
        description={[chosen.nhia_type, displayPlace(chosen.area), displayPlace(chosen.district), `NHIA file ${chosen.source_ref?.split("#")[1]?.replace("-", " ") ?? chosen.source_ref}`].filter(Boolean).join(" · ")}
        action={<Button href={PATH} variant="secondary">Another facility</Button>}
      />
      <AdminBody>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-6">
          <CallForm
            action={recordCallAction}
            facility={{ id: chosen.id, name: displayName(chosen.name) }}
            cards={insurers.map((i) => ({ id: i.id, label: i.name }))}
            services={services.map((s) => ({ id: s.id, label: s.name }))}
            callers={[...ctx.callers].map(([id, email]) => ({ id, label: email }))}
            me={gate.staff.kind === "account" ? gate.staff.userId : null}
            nowLocal={nowLocal}
            canSave={canSave}
          />
          <Card title="On file now" titleId="on-file" divided>
            <dl className="space-y-3">
              <div>
                <dt className="text-small text-muted">Phone</dt>
                <dd className="font-semibold">{chosen.phone ?? "None yet"}</dd>
                {chosen.phone_checked_at && <dd className="text-small text-muted">Veriq call · {whenText(chosen.phone_checked_at, now)}</dd>}
              </div>
              <div>
                <dt className="text-small text-muted">Map location</dt>
                <dd className="font-semibold">
                  {chosen.location_source === "none" ? "None yet" : chosen.location_source === "osm" ? "From OpenStreetMap" : "Set by Veriq"}
                </dd>
              </div>
              <div>
                <dt className="text-small text-muted">Earlier calls</dt>
                <dd className="font-semibold">{before.length === 0 ? "None" : before.length}</dd>
                {before[0] && <dd className="text-small text-muted">Last: {whenText(before[0].called_at, now)}</dd>}
              </div>
            </dl>
            <SourceLine className="mt-3">{sourceLine(chosen)}</SourceLine>
          </Card>
        </div>
      </AdminBody>
    </>
  );
}
