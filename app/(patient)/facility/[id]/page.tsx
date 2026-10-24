import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardsAccepted, YourCard } from "@/components/facility/CardsAccepted";
import { TodayGrid } from "@/components/facility/TodayGrid";
import { BackLink } from "@/components/ui/BackLink";
import { Icon } from "@/components/ui/Icon";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { getFacilityDetail, listInsurers } from "@/lib/db/queries";
import { readDb } from "@/lib/db/server";
import type { SearchParams } from "@/lib/view/catalog";
import { buildFacilityView } from "@/lib/view/facility";

export const metadata: Metadata = { title: "Hospital detail" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function FacilityPage({
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
  // Read the clock once the database is ready (local mode seeds on first use).
  const now = new Date();
  const [detail, insurers] = await Promise.all([getFacilityDetail(db, id, now), listInsurers(db)]);
  if (!detail) notFound();

  const lat = Number(first(sp.lat));
  const lng = Number(first(sp.lng));
  const origin = first(sp.lat) && first(sp.lng) && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const view = buildFacilityView({ detail, insurers, origin, cardSlug: first(sp.card) ?? null, now });
  // The searched card's answer goes at the top: it is the question the person came with (rule B).
  const yourCard = view.cards.find((c) => c.insurer.slug === first(sp.card)) ?? null;

  return (
    <div className="min-h-dvh bg-page pb-8">
      <header className="bg-white px-4 pb-4 pt-4">
        <div className="flex items-start gap-2">
          <BackLink fallback="/find" label="Back to results" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-2xl font-extrabold leading-tight">{view.name}</h1>
              <SampleDataTag className="mt-1 shrink-0" />
            </div>
            <p className="mt-1 text-ink/70">{view.subtitle}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {view.phone && (
                <a
                  href={`tel:${view.phone.replace(/\s/g, "")}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 font-bold text-white"
                >
                  <Icon name="phone" className="h-5 w-5" /> Call
                </a>
              )}
              <a
                href={view.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-5 font-bold"
              >
                Directions
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-4 pt-4">
        {yourCard && <YourCard card={yourCard} />}
        <TodayGrid tiles={view.today} updated={view.todayUpdated} />
        {/* The searched card is shown once, above; the rest follow with their badge and source (rule 4). */}
        <CardsAccepted
          cards={yourCard ? view.cards.filter((c) => c !== yourCard) : view.cards}
          title={yourCard ? "Other cards" : "Cards accepted"}
          howWeCheck={!yourCard}
        />
        <Link
          href={`/facility/${view.id}/report${first(sp.card) ? `?card=${first(sp.card)}` : ""}`}
          className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-brand/50 px-4 py-3 font-bold text-brand"
        >
          Been here? Tell others if your card worked
          <Icon name="chevron" className="h-5 w-5" />
        </Link>
      </main>
    </div>
  );
}
