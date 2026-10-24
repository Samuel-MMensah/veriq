import type { Metadata } from "next";
import { DemoLogin } from "@/components/staff/DemoLogin";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { currentStaff, demoLoginEnabled } from "@/lib/auth/session";
import { getInsurerNetwork } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import { insurerFigures } from "@/lib/rules/kpi";
import { agoText, ageMs } from "@/lib/rules/time";

export const metadata: Metadata = { title: "Insurer network health" };

const pct = (share: number) => `${Math.round(share * 100)}%`;
// The refusals table scrolls inside a "relative" box, so its visually hidden header can't widen the page (rule 7).
const n = (x: number) => x.toLocaleString("en-GB");

// Screen 18, read-only (rule K). Phase 1: the NHIS demo login.
export default async function NetworkPage() {
  const staff = await currentStaff();
  if (staff?.role !== "insurer") {
    return (
      <>
        <StaffHeader product="insurers" staff={null} title="Network health" subtitle="Is your provider list true on the ground?" path="/i/network" />
        <DemoLogin account="insurer-nhis" who="NHIS network team (Kojo)" next="/i/network" enabled={demoLoginEnabled()} />
      </>
    );
  }

  // Insurer staff see only their own insurer's figures (SPEC section 3, rule K).
  const db = await serviceDb();
  const now = new Date();
  const network = await getInsurerNetwork(db, staff.insurerId, now);
  if (!network) throw new Error("The demo insurer is missing from the data. Re-run the seed.");
  const k = insurerFigures({
    facilities: network.facilities,
    links: network.links,
    reports: network.reports,
    searches: network.searches,
    now,
  });
  const phoneOf = new Map(network.facilities.map((f) => [f.id, f.phone]));
  const maxGap = Math.max(1, ...k.gaps.map((g) => g.searches));

  return (
    <>
      <StaffHeader
        product="insurers"
        staff={staff}
        title="Network health"
        subtitle={`${network.insurer.name} · Is your provider list true on the ground? Last 30 days.`}
        path="/i/network"
      />
      <main className="space-y-4 px-4 py-4">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Last 30 days">
          <Tile label="Hospitals on your list" value={n(k.onList)} />
          <Tile label="Confirmed by hospital" value={n(k.confirmed)} note={`${pct(k.confirmedShareOfList)} of your list`} tone="brand" />
          <Tile label="Members refused" value={n(k.refused.count)} note={`at ${k.refused.facilities} hospitals`} tone="refused" />
          <Tile
            label="Member searches"
            value={n(k.searches.total)}
            note={`${pct(k.searches.confirmedShare)} found a confirmed hospital`}
          />
        </ul>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section aria-labelledby="turned-away" className="min-w-0 rounded-2xl bg-white p-4 shadow-sm lg:col-span-2">
            <h2 id="turned-away" className="text-lg font-bold">
              Where members were turned away
            </h2>
            {k.turnedAway.length === 0 ? (
              <p className="mt-2 text-ink/70">No refusals reported in the last 30 days.</p>
            ) : (
              <div className="relative mt-2 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left">
                  <thead className="text-sm text-ink/70">
                    <tr className="border-b border-ink/10">
                      <th scope="col" className="py-2 pr-3 font-semibold">Hospital</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Your list says</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Refusals</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Last report</th>
                      <th scope="col" className="py-2"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {k.turnedAway.map((row) => {
                      const phone = phoneOf.get(row.facilityId);
                      return (
                        <tr key={row.facilityId} className="border-b border-ink/10 last:border-0">
                          <th scope="row" className="py-3 pr-2 font-semibold">{row.name}</th>
                          <td className="py-3 pr-2">{row.listed ? "In network" : "Not listed"}</td>
                          <td className={`py-3 pr-2 font-bold ${row.refusals ? "text-refused-ink" : "text-brand"}`}>{row.refusals}</td>
                          <td className="py-3 pr-2 text-ink/80">
                            {row.refusals === 0 && !row.listed
                              ? `${row.accepted} members served`
                              : row.lastReportAt
                                ? agoText(ageMs(row.lastReportAt, now))
                                : "–"}
                          </td>
                          <td className="py-3 text-right">
                            {row.listed ? (
                              phone ? (
                                <a
                                  href={`tel:${phone.replace(/\s/g, "")}`}
                                  className="inline-flex min-h-11 items-center rounded-xl border border-brand px-3 font-bold text-brand"
                                >
                                  Call hospital
                                </a>
                              ) : null
                            ) : (
                              <span
                                aria-disabled="true"
                                title="List upload comes in the pilot (screen 19)"
                                className="inline-flex min-h-11 items-center rounded-xl bg-ink/10 px-3 font-bold text-ink/60"
                              >
                                Add to list (pilot)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="gaps" className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 id="gaps" className="text-lg font-bold">
              Coverage gaps
            </h2>
            <p className="mt-1 text-sm text-ink/70">
              Areas where members searched but found no confirmed hospital within 5 km.
            </p>
            {k.gaps.length === 0 ? (
              <p className="mt-3 text-ink/70">None in the last 30 days.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {k.gaps.slice(0, 6).map((g) => (
                  <li key={g.areaCell}>
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">{g.nearestArea ?? `Area ${g.areaCell}`}</span>
                      <span className="text-ink/80">{n(g.searches)} searches</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-ink/10" aria-hidden="true">
                      <div className="h-2 rounded-full bg-refused" style={{ width: `${(g.searches / maxGap) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <p className="text-sm text-ink/70">Sample insurer view · Greater Accra · Counts only; no member names are ever shown.</p>
      </main>
    </>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "brand" | "refused" }) {
  const color = tone === "brand" ? "text-brand" : tone === "refused" ? "text-refused-ink" : "text-ink";
  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm text-ink/80">{label}</p>
      <p className={`mt-1 text-4xl font-extrabold ${color}`}>{value}</p>
      {note && <p className="mt-1 text-sm text-ink/80">{note}</p>}
    </li>
  );
}
