import type { Metadata } from "next";
import Link from "next/link";
import { DemoLogin } from "@/components/staff/DemoLogin";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { Icon } from "@/components/ui/Icon";
import { currentStaff, demoLoginEnabled } from "@/lib/auth/session";
import { listNeedsLocation } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import type { FacilityRow } from "@/lib/db/types";
import { sourceLine } from "@/lib/rules/directory";
import type { SearchParams } from "@/lib/view/catalog";
import { displayName, displayPlace } from "@/lib/view/names";
import { setLocationAction } from "./actions";

export const metadata: Metadata = { title: "Admin" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Admin (Prompt 9): real NHIA facilities with no confident map location (rule D1). Until one is set
// here (location_source = admin), the facility is left out of every distance search and emergency mode.
export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await currentStaff();
  if (staff?.role !== "admin") {
    return (
      <div className="mx-auto min-h-dvh max-w-md bg-page">
        <StaffHeader product="admins" staff={null} title="Admin" path="/admin/" />
        <DemoLogin account="admin-demo" who="the demo presenter" next="/admin/" enabled={demoLoginEnabled()} />
      </div>
    );
  }

  const sp = await searchParams;
  const error = first(sp.error);
  const setId = first(sp.set);
  const facilities = await listNeedsLocation(await serviceDb());
  const byDistrict = new Map<string, FacilityRow[]>();
  for (const f of facilities) {
    const key = displayPlace(f.district) ?? f.district;
    byDistrict.set(key, [...(byDistrict.get(key) ?? []), f]);
  }
  const districts = [...byDistrict].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-page">
      {/* Real facilities only on this screen, so no SAMPLE DATA tag (rule 1). */}
      <StaffHeader product="admins" staff={staff} title="Admin" subtitle="Real facilities from the NHIA list" path="/admin/" sample={false} />
      <main className="space-y-4 px-4 py-4">
        {setId && (
          <p role="status" className="flex gap-3 rounded-2xl bg-brand/10 p-4 font-semibold text-brand">
            <Icon name="check" className="mt-0.5 h-5 w-5" />
            Location saved. The facility now shows in searches near it.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-emergency-bg p-4 font-semibold text-emergency">
            {error}
          </p>
        )}

        <section aria-labelledby="needs-location" className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 id="needs-location" className="text-lg font-bold">
            Needs a location ({facilities.length})
          </h2>
          <p className="mt-1 text-ink/80">
            We found no sure match on OpenStreetMap for these, so patients can&apos;t find them by distance yet. Check the place,
            then paste its latitude and longitude, e.g. 5.5612, -0.2601.
          </p>
          {facilities.length === 0 ? (
            <p className="mt-3 text-ink/70">Every facility has a location.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {districts.map(([district, list]) => (
                <details key={district} className="rounded-xl border border-ink/10">
                  <summary className="flex min-h-12 cursor-pointer items-center justify-between px-3 font-semibold">
                    {district} <span className="text-ink/70">{list.length}</span>
                  </summary>
                  <ul className="divide-y divide-ink/10">
                    {list.map((f) => (
                      <li key={f.id} id={`f-${f.id}`} className="px-3 py-3">
                        <p className="font-semibold">{displayName(f.name)}</p>
                        <p className="text-sm text-ink/80">
                          {[f.nhia_type, displayPlace(f.area) ?? "No location in the file"].join(" · ")}
                        </p>
                        <p className="text-xs text-ink/70">
                          {sourceLine(f)} · {f.source_ref}
                        </p>
                        <form action={setLocationAction} className="mt-2 flex gap-2">
                          <input type="hidden" name="facility" value={f.id} />
                          <label className="sr-only" htmlFor={`loc-${f.id}`}>
                            Latitude and longitude for {displayName(f.name)}
                          </label>
                          <input
                            id={`loc-${f.id}`}
                            name="location"
                            inputMode="decimal"
                            placeholder="5.5612, -0.2601"
                            className="min-h-11 min-w-0 flex-1 rounded-xl border border-ink/20 px-3"
                          />
                          <button type="submit" className="min-h-11 rounded-xl bg-brand px-4 font-bold text-white">
                            Save
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </section>

        <p className="text-sm text-ink/70">
          Map data from OpenStreetMap ©{" "}
          <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noopener noreferrer">
            OpenStreetMap contributors
          </a>
          , ODbL.
        </p>
        <Link href="/admin/demo" className="flex min-h-12 items-center justify-center font-bold text-brand underline">
          Demo data
        </Link>
      </main>
    </div>
  );
}
