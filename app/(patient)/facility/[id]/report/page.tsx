import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/components/report/ReportForm";
import { Icon } from "@/components/ui/Icon";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { getFacility, listInsurers } from "@/lib/db/queries";
import { readDb } from "@/lib/db/server";
import { REPORTS_CLOSED_TEXT, reportsLive, reportsOpen, showSampleTag } from "@/lib/rules/directory";
import { displayName } from "@/lib/view/names";
import { CARD_OPTIONS, type SearchParams } from "@/lib/view/catalog";

export const metadata: Metadata = { title: "Was your card accepted?" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Screen 4. The form saves on the phone first, so it works offline (rule 8).
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const db = await readDb();
  const [facility, insurers] = await Promise.all([getFacility(db, id), listInsurers(db)]);
  if (!facility) notFound();

  // The Find screen's cards first, in their order, then any others.
  const order = (slug: string) => {
    const i = CARD_OPTIONS.findIndex((c) => c.slug === slug);
    return i === -1 ? CARD_OPTIONS.length : i;
  };
  const cards = [...insurers]
    .sort((a, b) => order(a.slug) - order(b.slug) || a.name.localeCompare(b.name))
    .map((i) => ({ id: i.id, slug: i.slug, name: i.name }));
  if (cards.length === 0) notFound();
  const initial = cards.find((c) => c.slug === first(sp.card)) ?? cards[0]!;

  return (
    <main className="flex min-h-dvh flex-col px-4 pb-6 pt-4">
      <div className="flex items-center gap-2">
        <Link
          href={`/facility/${facility.id}?card=${initial.slug}`}
          aria-label="Close"
          className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5"
        >
          <Icon name="close" className="h-6 w-6" />
        </Link>
        <p className="flex-1 truncate text-lg text-ink/70">{displayName(facility.name)}</p>
        {showSampleTag([facility]) && <SampleDataTag />}
      </div>
      <div className="mt-4 flex flex-1 flex-col">
        {/* Rule R1: reports on real facilities are closed until REPORTS_LIVE=on. */}
        {reportsOpen(facility, reportsLive(process.env.REPORTS_LIVE)) ? (
          <ReportForm facilityId={facility.id} cards={cards} initialCardId={initial.id} />
        ) : (
          <div className="rounded-2xl bg-page p-5">
            <h1 className="text-2xl font-extrabold">Was your card accepted?</h1>
            <p className="mt-2 text-lg text-ink/80">{REPORTS_CLOSED_TEXT}</p>
            {facility.phone && (
              <a
                href={`tel:${facility.phone.replace(/\s/g, "")}`}
                className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-bold text-white"
              >
                Call the hospital
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
