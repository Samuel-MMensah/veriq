import type { Metadata } from "next";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import type { NavItem } from "@/components/staff/StaffNav";
import { StaffBody, StaffPageHeader, StaffShell } from "@/components/staff/StaffShell";
import { buttonClass } from "@/components/ui/Button";
import { staffGate } from "@/lib/auth/session";
import { getInsurerNetwork } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import { countsNhiaList, insurerFigures } from "@/lib/rules/kpi";
import { agoText, ageMs } from "@/lib/rules/time";
import { telHref } from "@/lib/view/phone";

export const metadata: Metadata = { title: "Insurer network health" };

const pct = (share: number) => `${Math.round(share * 100)}%`;
// Rule 7: under 640 px the refusals table reads as stacked rows, each value with its own label, so it never
// scrolls sideways at 390 px. The header stays for screen readers inside a "relative" box.
const n = (x: number) => x.toLocaleString("en-GB");
/** A cell as one "label  value" line in the stacked layout. */
const STACKED =
  "max-sm:flex max-sm:justify-between max-sm:gap-3 max-sm:py-1 max-sm:before:font-normal max-sm:before:text-muted max-sm:before:content-[attr(data-label)]";

const PATH = "/i/network";
const NAV: NavItem[] = [{ href: PATH, label: "Network health", icon: "shield" }];

// Screen 18, read-only (rule K). Real insurer accounts, and the NHIS demo login for rehearsals.
export default async function NetworkPage() {
  const gate = await staffGate("insurer", PATH);
  if (!gate.ok) return <StaffGateScreen role="insurer" staff={gate.staff} path={PATH} />;
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
    <StaffShell staff={staff} area="insurers" nav={NAV} signOutTo={PATH}>
      <StaffPageHeader title="Network health" description={`${network.insurer.name} · Last 30 days`} sample={staff.kind === "demo"} />
      <StaffBody>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Last 30 days">
          <Tile label="Hospitals on your list" value={n(k.onList)} />
          <Tile label="Confirmed by hospital" value={n(k.confirmed)} note={`${pct(k.confirmedShareOfList)} of your list`} tone="brand" />
          {/* rule K: a Veriq call is its own figure, never added to "Confirmed by hospital". */}
          <Tile label="Confirmed by Veriq call" value={n(k.confirmedByCall)} note={`${pct(k.confirmedByCallShareOfList)} of your list`} tone="brand" />
          <Tile label="Members refused" value={n(k.refused.count)} note={`at ${k.refused.facilities} hospitals`} tone="refused" />
          <Tile
            wide
            label="Member searches"
            value={n(k.searches.total)}
            note={`${pct(k.searches.confirmedShare)} found a confirmed hospital`}
          />
        </ul>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section aria-labelledby="turned-away" className="min-w-0 rounded-(--radius-card) bg-surface p-4 shadow-card sm:p-5 lg:col-span-2">
            <h2 id="turned-away" className="-mx-4 border-b border-line px-4 pb-3 text-section sm:-mx-5 sm:px-5">
              Where members were turned away
            </h2>
            {k.turnedAway.length === 0 ? (
              <p className="mt-2 text-muted">No refusals reported in the last 30 days.</p>
            ) : (
              <div className="relative mt-2">
                <table className="w-full text-left max-sm:block">
                  <thead className="text-small text-muted max-sm:sr-only">
                    <tr className="border-b border-line">
                      <th scope="col" className="py-2 pr-3 font-semibold">Hospital</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Your list</th>
                      <th scope="col" className="py-2 pr-3 text-right font-semibold">Refusals</th>
                      <th scope="col" className="py-2 pr-3 font-semibold">Last report</th>
                      <th scope="col" className="py-2"><span className="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody className="max-sm:block">
                    {k.turnedAway.map((row) => {
                      const tel = telHref(phoneOf.get(row.facilityId));
                      return (
                        <tr key={row.facilityId} className="border-b border-line last:border-0 max-sm:block max-sm:py-3">
                          <th scope="row" className="py-3 pr-2 font-semibold max-sm:block max-sm:py-0">{row.name}</th>
                          <td data-label="Your list" className={`py-3 pr-2 whitespace-nowrap ${STACKED}`}>{row.listed ? "In network" : "Not listed"}</td>
                          <td data-label="Refusals" className={`py-3 pr-3 text-right font-semibold ${STACKED} ${row.refusals ? "text-warn-ink" : "text-brand"}`}>{row.refusals}</td>
                          <td data-label="Last report" className={`py-3 pr-2 whitespace-nowrap text-muted ${STACKED}`}>
                            {row.refusals === 0 && !row.listed
                              ? `${row.accepted} members served`
                              : row.lastReportAt
                                ? agoText(ageMs(row.lastReportAt, now))
                                : "–"}
                          </td>
                          <td className="py-3 text-right max-sm:block max-sm:pb-0 max-sm:pt-2 max-sm:text-left">
                            {/* Prompt 10c: no disabled placeholders ("Add to list" waits for screen 19). Call shows
                                only for a number that can really be called, never a demo placeholder. */}
                            {row.listed && tel ? (
                              <a
                                href={tel}
                                aria-label={`Call ${row.name}`}
                                className={buttonClass({ variant: "secondary" })}
                              >
                                Call
                              </a>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="gaps" className="rounded-(--radius-card) bg-surface p-4 shadow-card sm:p-5">
            <h2 id="gaps" className="-mx-4 border-b border-line px-4 pb-3 text-section sm:-mx-5 sm:px-5">
              Coverage gaps
            </h2>
            <p className="mt-3 text-small text-muted">No confirmed hospital within 5 km of the search.</p>
            {k.gaps.length === 0 ? (
              <p className="mt-3 text-muted">None in the last 30 days.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {k.gaps.slice(0, 6).map((g) => (
                  <li key={g.areaCell}>
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">{g.nearestArea ?? `Area ${g.areaCell}`}</span>
                      <span className="text-small text-muted">{n(g.searches)} searches</span>
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

        <p className="text-small text-muted">Counts only. No member names.</p>
      </StaffBody>
    </StaffShell>
  );
}

/** A KPI tile: the number first, then what it counts. Every tile in a row is the same height. */
function Tile({ label, value, note, tone, wide }: { label: string; value: string; note?: string; tone?: "brand" | "refused"; wide?: boolean }) {
  const color = tone === "brand" ? "text-brand" : tone === "refused" ? "text-warn-ink" : "text-ink";
  return (
    // An odd fifth tile spans the row on a phone, so the grid has no hole.
    <li className={`flex h-full flex-col rounded-(--radius-card) bg-surface p-4 shadow-card ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <p className={`text-display ${color}`}>{value}</p>
      <p className="mt-1 text-small font-semibold">{label}</p>
      {note && <p className="mt-auto pt-2 text-small text-muted">{note}</p>}
    </li>
  );
}
