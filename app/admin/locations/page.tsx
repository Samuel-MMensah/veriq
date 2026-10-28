import type { Metadata } from "next";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { LocationForm } from "@/components/admin/LocationForm";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { inputClass } from "@/components/ui/Field";
import { SourceLine } from "@/components/ui/SourceLine";
import { Toast } from "@/components/ui/Toast";
import { matchesSearch } from "@/lib/admin/location";
import { loadFacility } from "@/lib/admin/log";
import { staffGate } from "@/lib/auth/session";
import { adminMayAct } from "@/lib/auth/staff";
import { listNeedsLocation } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import type { FacilityRow } from "@/lib/db/types";
import { sourceLine } from "@/lib/rules/directory";
import type { SearchParams } from "@/lib/view/catalog";
import { displayName, displayPlace } from "@/lib/view/names";
import { accraClock } from "@/lib/view/status";
import { setLocationAction } from "../actions";

export const metadata: Metadata = { title: "Needs a location" };

const PATH = "/admin/locations";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Rule D1: real NHIA facilities with no sure map location. Until one is set here (location_source =
// admin), the facility is left out of every distance search and emergency mode.
export default async function LocationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Needs a location" path={PATH} />;
  const { staff } = gate;
  const sp = await searchParams;
  const q = (first(sp.q) ?? "").trim();
  const db = await serviceDb();
  const savedRow = first(sp.saved) ? await loadFacility(db, first(sp.saved)!) : null;
  const saved = savedRow ? displayName(savedRow.name) : null;
  const all = await listNeedsLocation(db);
  const canEdit = all[0] ? adminMayAct(staff, all[0]) : true;
  const shown = q ? all.filter((f) => matchesSearch({ name: displayName(f.name), district: displayPlace(f.district) ?? f.district, area: displayPlace(f.area) }, q)) : all;
  const byDistrict = new Map<string, FacilityRow[]>();
  for (const f of shown) {
    const key = displayPlace(f.district) ?? f.district;
    byDistrict.set(key, [...(byDistrict.get(key) ?? []), f]);
  }
  const districts = [...byDistrict].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <>
      <AdminPageHeader
        title="Needs a location"
        description="Not on the map yet, so not in any distance search."
      />
      <AdminBody>
        {saved && <Toast>Location saved for {saved}. It now shows in searches near it.</Toast>}
        <form role="search" className="flex gap-2" action={PATH}>
          <label htmlFor="q" className="sr-only">
            Search by name or district
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Search by name or district" className={`${inputClass()} min-w-0 flex-1`} />
          <Button variant="secondary" icon="search">
            Search
          </Button>
        </form>
        <SourceLine>
          {all[0] ? sourceLine(all[0]) : "From the NHIA list"} · {all.length} without a location at {accraClock(new Date().toISOString())}
          {q && <> · {shown.length} match &quot;{q}&quot;</>}
        </SourceLine>
        {!canEdit && (
          <Card tone="warn">
            <p>Demo login: you can look, not save. Sign in with your admin account to save.</p>
          </Card>
        )}

        {shown.length === 0 ? (
          <Card>
            <EmptyState icon={q ? "search" : "check"} title={q ? "No facility matches" : "Every facility has a location"} compact>
              {q ? "Try part of the name, or the district." : "Nothing to do here."}
            </EmptyState>
          </Card>
        ) : (
          <div className={q ? "space-y-2" : "grid grid-cols-1 items-start gap-2 lg:grid-cols-2"}>
            {districts.map(([district, list]) => (
              <details key={district} open={Boolean(q)} className="group rounded-(--radius-card) bg-surface shadow-card">
                <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 font-semibold">
                  {district}
                  <span className="rounded-full bg-neutral-bg px-2.5 py-0.5 text-small text-neutral-ink tabular-nums">{list.length}</span>
                </summary>
                <ul className="divide-y divide-line border-t border-line">
                  {list.map((f) => (
                    <li key={f.id} id={`f-${f.id}`} className="px-4 py-4">
                      <p className="font-semibold">{displayName(f.name)}</p>
                      <p className="text-small text-muted">{[f.nhia_type, displayPlace(f.area) ?? "No area in the file"].join(" · ")}</p>
                      <p className="text-small text-muted">
                        {sourceLine(f)} · {f.source_ref}
                      </p>
                      {canEdit && <LocationForm facilityId={f.id} name={displayName(f.name)} query={q} action={setLocationAction} />}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}

        <p className="text-small text-muted">
          Map data and tiles ©{" "}
          <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noopener noreferrer">
            OpenStreetMap contributors
          </a>
          , ODbL.
        </p>
      </AdminBody>
    </>
  );
}
