import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { MyReportCounts } from "@/components/report/MyReportCounts";
import { Icon } from "@/components/ui/Icon";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { getFacilityDetail, getInsurerBySlug } from "@/lib/db/queries";
import { readDb } from "@/lib/db/server";
import { showSampleTag } from "@/lib/rules/directory";
import type { SearchParams } from "@/lib/view/catalog";
import { whatChanged, type Change } from "@/lib/view/thanks";

export const metadata: Metadata = { title: "After a report" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Screen 11: what the report changed on the hospital page, recalculated with lib/rules.
export default async function ThanksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const state = first(sp.state);
  const facilityId = first(sp.facility) ?? "";
  const cardSlug = first(sp.card) ?? "";
  const reportId = first(sp.report) ?? "";

  let facilityName: string | null = null;
  let demoFacility = false;
  let change: Change = { kind: "none" };
  let wasTopUp = false;
  if (UUID.test(facilityId)) {
    const db = await readDb();
    const now = new Date();
    const [detail, insurer] = await Promise.all([getFacilityDetail(db, facilityId, now), getInsurerBySlug(db, cardSlug)]);
    facilityName = detail?.facility.name ?? null;
    demoFacility = detail ? showSampleTag([detail.facility]) : false;
    if (detail && insurer && state === "counted" && UUID.test(reportId)) {
      change = whatChanged({ detail, insurerId: insurer.id, cardName: insurer.name, reportId, now });
      wasTopUp = detail.reports.some((r) => r.id === reportId && r.outcome === "topup");
    }
  }

  const host = (await headers()).get("host");
  const shareText = `Before you go to a hospital, check if it really takes your card: ${host ? `https://${host}` : "Veriq Health"}`;
  const back = facilityName ? `/facility/${facilityId}?card=${cardSlug}` : "/find";

  const title =
    state === "queued"
      ? "Saved on your phone."
      : state === "held"
        ? "Thank you. We'll check it first."
        : "Thank you. The next person will know.";
  // Prompt 10c: one short line, only where it explains what happens next.
  const lead =
    state === "queued"
      ? "It sends when you're back online."
      : state === "held"
        ? "Many reports came in this hour, so we check new ones before they count."
        : null;

  return (
    <main className="flex min-h-dvh animate-enter flex-col px-4 pt-10 pb-6">
      <div className="flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon name={state === "queued" ? "clock" : "check"} className="h-6 w-6" />
        </span>
        {demoFacility && <SampleDataTag />}
      </div>
      <h1 className="mt-4 text-title">{title}</h1>
      {lead && <p className="mt-2 text-muted">{lead}</p>}

      {facilityName && state === "counted" && (
        <section aria-labelledby="changed" className="mt-6 rounded-(--radius-card) bg-surface p-4 shadow-card">
          <h2 id="changed" className="text-section">
            What changed
          </h2>
          <ChangeText facilityName={facilityName} change={change} />
          {wasTopUp && (
            <p className="mt-3 text-small text-muted">We&apos;ll ask the hospital to confirm this top-up.</p>
          )}
        </section>
      )}

      <div className="mt-6">
        <MyReportCounts />
      </div>

      <div className="mt-auto space-y-3 pt-10">
        <Link href={back} className="flex min-h-12 w-full items-center justify-center rounded-(--radius-control) bg-brand font-semibold text-white">
          Done
        </Link>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center font-semibold text-brand"
        >
          Tell a friend about Veriq
        </a>
      </div>
    </main>
  );
}

function ChangeText({ facilityName, change }: { facilityName: string; change: Change }) {
  if (change.kind === "none") {
    return <p className="mt-2">Saved. It will show on {facilityName}&apos;s page shortly.</p>;
  }
  if (change.kind === "history") {
    return (
      <p className="mt-2">
        {facilityName} still shows: <strong className="font-semibold">{change.headline}</strong>. Your report is counted.
      </p>
    );
  }
  return (
    <>
      <p className="mt-2">
        {facilityName} now shows: <strong className="font-semibold">{change.headline}</strong>.
      </p>
      {change.before && <p className="mt-2 text-small text-muted">Before your report: {change.before}.</p>}
    </>
  );
}
