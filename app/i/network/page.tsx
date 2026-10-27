import type { Metadata } from "next";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { staffGate } from "@/lib/auth/session";
import { getInsurerNetwork } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import { countsNhiaList, insurerFigures } from "@/lib/rules/kpi";
import { agoText, ageMs } from "@/lib/rules/time";

export const metadata: Metadata = { title: "Insurer network health" };

const pct = (share: number) => `${Math.round(share * 100)}%`;
// Rule 7: under 640 px the refusals table reads as stacked rows, each value with its own label, so it never
// scrolls sideways at 390 px. The header stays for screen readers inside a "relative" box.
const n = (x: number) => x.toLocaleString("en-GB");
/** A cell as one "label  value" line in the stacked layout. */
const STACKED =
  "max-sm:flex max-sm:justify-between max-sm:gap-3 max-sm:py-1 max-sm:before:font-normal max-sm:before:text-muted max-sm:before:content-[attr(data-label)]";

// Screen 18, read-only (rule K). Phase 1: the NHIS demo login.
export default async function NetworkPage() {
  const gate = await staffGate("insurer", "/i/network");
  if (!gate.ok) {
    return <StaffGateScreen role="insurer" staff={gate.staff} title="Network health" subtitle="Is your provider list true on the ground?" path="/i/network" />;
  }
  const { staff } = gate;

  // Insurer staff see only their own insurer's figures (SPEC section 3, rule K).
  const db = await serviceDb();
  const now = new Date();
  // Rule D2: the demo login sees the demo world; a real insurer account sees real facilities only.
  const network = staff.insurerId ? await getInsurerNetwork(db, staff.insurerId, now, staff.kind === "demo") : null;
  if (!network) throw new Error("This account isn't linked to an insurer. Ask a Veriq admin to link it.");
  const k = insurerFigures({
    facilities: network.facilities,
    links: network.links,
    reports: network.reports,
    searches: network.searches,
    now,
    // rule K: NHIA listings are the NHIS list; a private insurer counts only its own.
    nhiaListCounts: countsNhiaList(network.insurer),
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
          <section aria-labelledby="turned-away" className="min-w-0 rounded-(--radius-card) bg-surface p-4 shadow-card lg:col-span-2">
            <h2 id="turned-away" className="text-lg font-bold">
              Where members were turned away
            </h2>
            {k.turnedAway.length === 0 ? (
              <p className="mt-2 text-muted">No refusals reported in the last 30 days.</p>
            ) : (
              <div className="relative mt-2">
                <table className="w-full text-left max-sm:block">
                  <thead className="text-sm text-muted max-sm:sr-only">
                    <tr className="border-b border-line">
                      <th scope="col" className="py-2 pr-3 font-semibold">Hospital</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Your list says</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Refusals</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Last report</th>
                      <th scope="col" className="py-2"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="max-sm:block">
                    {k.turnedAway.map((row) => {
                      const phone = phoneOf.get(row.facilityId);
                      return (
                        <tr key={row.facilityId} className="border-b border-line last:border-0 max-sm:block max-sm:py-3">
                          <th scope="row" className="py-3 pr-2 font-semibold max-sm:block max-sm:py-0 max-sm:text-lg">{row.name}</th>
                          <td data-label="Your list says" className={`py-3 pr-2 ${STACKED}`}>{row.listed ? "In network" : "Not listed"}</td>
                          <td data-label="Refusals" className={`py-3 pr-2 font-bold ${STACKED} ${row.refusals ? "text-refused-ink" : "text-brand"}`}>{row.refusals}</td>
                          <td data-label="Last report" className={`py-3 pr-2 text-muted ${STACKED}`}>
                            {row.refusals === 0 && !row.listed
                              ? `${row.accepted} members served`
                              : row.lastReportAt
                                ? agoText(ageMs(row.lastReportAt, now))
                                : "–"}
                          </td>
                          <td className="py-3 text-right max-sm:block max-sm:pb-0 max-sm:pt-2 max-sm:text-left">
                            {row.listed ? (
                              phone ? (
                                <a
                                  href={`tel:${phone.replace(/\s/g, "")}`}
                                  className="inline-flex min-h-11 items-center rounded-(--radius-control) border border-brand px-3 font-bold text-brand"
                                >
                                  Call hospital
                                </a>
                              ) : null
                            ) : (
                              <span
                                aria-disabled="true"
                                title="List upload comes in the pilot (screen 19)"
                                className="inline-flex min-h-11 items-center rounded-(--radius-control) bg-ink/10 px-3 font-bold text-ink/60"
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

          <section aria-labelledby="gaps" className="rounded-(--radius-card) bg-surface p-4 shadow-card">
            <h2 id="gaps" className="text-lg font-bold">
              Coverage gaps
            </h2>
            <p className="mt-1 text-sm text-muted">
              Areas where members searched but found no confirmed hospital within 5 km.
            </p>
            {k.gaps.length === 0 ? (
              <p className="mt-3 text-muted">None in the last 30 days.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {k.gaps.slice(0, 6).map((g) => (
                  <li key={g.areaCell}>
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">{g.nearestArea ?? `Area ${g.areaCell}`}</span>
                      <span className="text-muted">{n(g.searches)} searches</span>
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

        <p className="text-sm text-muted">Sample insurer view · Greater Accra · Counts only; no member names are ever shown.</p>
      </main>
    </>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "brand" | "refused" }) {
  const color = tone === "brand" ? "text-brand" : tone === "refused" ? "text-refused-ink" : "text-ink";
  return (
    <li className="rounded-(--radius-card) bg-surface p-4 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-4xl font-extrabold ${color}`}>{value}</p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
    </li>
  );
}
