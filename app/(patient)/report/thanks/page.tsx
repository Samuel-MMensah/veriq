import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { MyReportCounts } from "@/components/report/MyReportCounts";
import { Icon } from "@/components/ui/Icon";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { getFacilityDetail, getInsurerBySlug } from "@/lib/db/queries";
import { readDb } from "@/lib/db/server";
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
  let change: Change = { kind: "none" };
  if (UUID.test(facilityId)) {
    const db = await readDb();
    const now = new Date();
    const [detail, insurer] = await Promise.all([getFacilityDetail(db, facilityId, now), getInsurerBySlug(db, cardSlug)]);
    facilityName = detail?.facility.name ?? null;
    if (detail && insurer && state === "counted" && UUID.test(reportId)) {
      change = whatChanged({ detail, insurerId: insurer.id, cardName: insurer.name, reportId, now });
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
  const lead =
    state === "queued"
      ? "You're offline right now. We'll send your report as soon as you're back online. Nothing else to do."
      : state === "held"
        ? "Many reports came in for this hospital in the last hour, so we check new ones before they count."
        : "Your report is anonymous and is now part of what people see.";

  return (
    <main className="flex min-h-dvh flex-col px-6 pb-6 pt-10">
      <div className="flex items-start justify-between">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Icon name={state === "queued" ? "clock" : "check"} className="h-10 w-10" />
        </span>
        <SampleDataTag />
      </div>
      <h1 className="mt-6 text-3xl font-extrabold leading-tight">{title}</h1>
      <p className="mt-2 text-lg text-ink/80">{lead}</p>

      {facilityName && state === "counted" && (
        <section aria-labelledby="changed" className="mt-6 rounded-2xl bg-page p-5">
          <h2 id="changed" className="text-sm font-bold uppercase tracking-wide text-ink/70">
            What changed
          </h2>
          <ChangeText facilityName={facilityName} change={change} />
        </section>
      )}

      <div className="mt-6">
        <MyReportCounts />
      </div>

      <div className="mt-auto space-y-3 pt-10">
        <Link href={back} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white">
          Done
        </Link>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center font-bold text-brand"
        >
          Tell a friend about Veriq
        </a>
      </div>
    </main>
  );
}

function ChangeText({ facilityName, change }: { facilityName: string; change: Change }) {
  if (change.kind === "none") {
    return <p className="mt-2 text-lg">Your report is saved. It will show on {facilityName}&apos;s page shortly.</p>;
  }
  if (change.kind === "history") {
    return (
      <p className="mt-2 text-lg">
        {facilityName} still shows: <strong>{change.headline}</strong>. Your report is now part of these numbers.
      </p>
    );
  }
  return (
    <>
      <p className="mt-2 text-lg">
        {facilityName} now shows: <strong>{change.headline}</strong>.
      </p>
      {change.before && <p className="mt-2 text-ink/70">Before your report: {change.before}.</p>}
    </>
  );
}
