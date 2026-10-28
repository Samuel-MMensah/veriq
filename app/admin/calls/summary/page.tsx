import type { Metadata } from "next";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SourceLine } from "@/components/ui/SourceLine";
import { staffGate } from "@/lib/auth/session";
import { loadCallSummary } from "@/lib/calls/record";
import { listInsurers } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import { whenText } from "@/lib/view/when";

export const metadata: Metadata = { title: "What the calls found" };

const PATH = "/admin/calls/summary";
const n = (x: number) => x.toLocaleString("en-GB");
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" });

// Prompt 10b, item 4: every call so far, per card, against the official list. The pitch number.
export default async function CallSummaryPage() {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="What the calls found" path={PATH} />;
  const db = await serviceDb();
  const now = new Date();
  const s = await loadCallSummary(db, await listInsurers(db));
  const [from, to] = [s.from, s.to].map((t) => (t ? DAY.format(new Date(t)) : null));
  const range = !from ? "No calls yet" : from === to ? from : `${from} to ${to}`;
  const asked = s.cards.filter((c) => c.called > 0);

  return (
    <>
      <AdminPageHeader
        title="What the calls found"
        description={`All calls · ${range}`}
        action={
          <a href="/admin/calls/summary/csv" download className={buttonClass({ variant: "secondary" })}>
            Download CSV
          </a>
        }
      />
      <AdminBody>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="All calls">
          <Tile value={n(s.calls)} label="Calls" />
          <Tile value={n(s.facilities)} label="Facilities called" />
          {asked
            .filter((c) => c.slug === "nhis")
            .map((c) => (
              <Tile key="m" value={n(c.matched)} label="NHIS answers that match the NHIA list" note={`of ${n(c.called)} ${c.called === 1 ? "facility" : "facilities"} asked`} />
            ))}
          {asked
            .filter((c) => c.slug === "nhis")
            .map((c) => (
              <Tile key="x" value={n(c.listedButRefuses + c.notListedButAccepts)} label="NHIS answers that don't" note={`${n(c.listedButRefuses)} listed but refuse · ${n(c.notListedButAccepts)} not listed but accept`} tone={c.listedButRefuses + c.notListedButAccepts > 0 ? "warn" : undefined} />
            ))}
        </ul>

        <Card title="Per card" titleId="per-card" aside={range} divided>
          {/* At 390 px the table scrolls on its own; a focusable region, so keyboards can scroll it too. */}
          <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Per card, scrolls sideways">
            <table className="w-full min-w-[40rem] text-left">
              <thead className="text-small text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-semibold">Card</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Facilities asked</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Match the list</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Listed, but refuse</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Not listed, but accept</th>
                  <th scope="col" className="py-2 text-right font-semibold">Accept · partial · no</th>
                </tr>
              </thead>
              <tbody>
                {s.cards.map((c) => (
                  <tr key={c.insurerId} className="border-b border-line last:border-0">
                    <th scope="row" className="py-3 pr-3 font-semibold">{c.card}</th>
                    <td className="py-3 pr-3 text-right font-semibold">{n(c.called)}</td>
                    <td className="py-3 pr-3 text-right">{n(c.matched)}</td>
                    <td className={`py-3 pr-3 text-right ${c.listedButRefuses ? "font-semibold text-warn-ink" : ""}`}>{n(c.listedButRefuses)}</td>
                    <td className={`py-3 pr-3 text-right ${c.notListedButAccepts ? "font-semibold text-warn-ink" : ""}`}>{n(c.notListedButAccepts)}</td>
                    <td className="py-3 text-right text-muted">
                      {n(c.accepts)} · {n(c.partial)} · {n(c.doesNot)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-1 border-t border-line pt-3 text-small text-muted">
            <p>Each facility counts once per card, with its newest call. &ldquo;Not asked&rdquo; doesn&apos;t count. Partial counts as accepting.</p>
            <p>The official list: for NHIS the NHIA list; for a private card, that insurer&apos;s own list (none uploaded yet).</p>
          </div>
          <SourceLine className="mt-3">From the Veriq call log and today&apos;s lists · counted {whenText(now.toISOString(), now)}</SourceLine>
        </Card>
      </AdminBody>
    </>
  );
}

function Tile({ value, label, note, tone }: { value: string; label: string; note?: string; tone?: "warn" }) {
  return (
    <li className="flex h-full flex-col rounded-(--radius-card) bg-surface p-4 shadow-card">
      <p className={`text-display ${tone === "warn" ? "text-warn-ink" : "text-ink"}`}>{value}</p>
      <p className="mt-1 text-small font-semibold">{label}</p>
      {note && <p className="mt-auto pt-2 text-small text-muted">{note}</p>}
    </li>
  );
}
