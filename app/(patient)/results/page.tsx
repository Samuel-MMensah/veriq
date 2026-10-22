import type { Metadata } from "next";
import Link from "next/link";
import { BadgeLegend } from "@/components/badges/BadgeLine";
import { ResultCardView } from "@/components/facility/ResultCardView";
import { BackLink } from "@/components/ui/BackLink";
import { Icon } from "@/components/ui/Icon";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { getInsurerBySlug, getSearchCandidates, listServices, logSearch } from "@/lib/db/queries";
import { readDb, serviceDb } from "@/lib/db/server";
import { areaCell } from "@/lib/geo";
import { CASH, cardName, parseSearch, type SearchParams } from "@/lib/view/catalog";
import { buildResults } from "@/lib/view/results";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const search = parseSearch(await searchParams);
  if (!search) return <BrokenSearch />;

  const db = await readDb();
  // Read the clock once the database is ready (local mode seeds on first use).
  const now = new Date();
  const withCard = search.card !== CASH;
  const [insurer, services] = await Promise.all([withCard ? getInsurerBySlug(db, search.card) : null, listServices(db)]);
  const service = services.find((s) => s.id === search.serviceId);
  if (!service || (withCard && !insurer)) return <BrokenSearch />;

  const candidates = await getSearchCandidates(db, {
    serviceId: service.id,
    insurerId: insurer?.id ?? null,
    lat: search.origin.lat,
    lng: search.origin.lng,
    radiusKm: search.radiusKm,
    now,
  });
  const results = buildResults({ candidates, withCard, origin: search.origin, radiusKm: search.radiusKm, now });

  // Rule K: count the search (card, ~2 km cell, found a confirmed hospital). Never blocks the page.
  try {
    await logSearch(await serviceDb(), {
      insurerId: insurer?.id ?? null,
      areaCell: areaCell(search.origin.lat, search.origin.lng),
      hadConfirmedResult: results.hadConfirmedResult,
    });
  } catch (e) {
    console.error(e);
  }

  const card = insurer?.name ?? cardName(CASH);
  const count = results.cards.length;
  const facilityQuery = `lat=${search.origin.lat}&lng=${search.origin.lng}&card=${search.card}`;
  const cashHref = `/results?service=${service.id}&card=${CASH}&lat=${search.origin.lat}&lng=${search.origin.lng}&r=${search.radiusKm}`;

  return (
    <div className="min-h-dvh bg-page">
      <header className="border-b border-ink/10 bg-white px-4 pb-3 pt-4">
        <div className="flex items-start gap-2">
          <BackLink fallback="/find" label="Back to search" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold leading-tight">
              {count} {count === 1 ? "hospital" : "hospitals"} near {search.areaName}
            </h1>
            <p className="text-sm text-ink/70">
              {service.name} · {card} · within {search.radiusKm} km
            </p>
          </div>
          {/* Screen 8 (map) is Phase 2. */}
          <span
            aria-disabled="true"
            title="The map comes in the pilot"
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-ink/15 px-3 text-sm font-semibold text-ink/50"
          >
            <Icon name="map" className="h-4 w-4" /> Map soon
          </span>
        </div>
      </header>

      <main className="space-y-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          {withCard ? <BadgeLegend /> : <p className="text-sm text-ink/80">Without a card, every hospital nearby is shown.</p>}
          <SampleDataTag />
        </div>

        {count === 0 ? (
          <div className="rounded-2xl bg-white p-4 text-ink/80 shadow-sm">
            <p className="font-semibold text-ink">
              No hospitals within {search.radiusKm} km {withCard ? `that take ${card}` : "offer this"}.
            </p>
            <p className="mt-1 text-sm">Try a bigger area, or call a hospital before you go.</p>
            <Link href="/find" className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand underline">
              Change the search
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {results.cards.map((c) => (
              <ResultCardView
                key={c.id}
                card={c}
                href={`/facility/${c.id}?${facilityQuery}`}
                cardName={withCard ? card : null}
                serviceName={service.name}
              />
            ))}
          </ul>
        )}

        {results.hiddenCount > 0 && (
          <p className="text-sm text-ink/80">
            {results.hiddenCount} more {results.hiddenCount === 1 ? "hospital" : "hospitals"} nearby{" "}
            {results.hiddenCount === 1 ? "doesn't" : "don't"} take {card} or {results.hiddenCount === 1 ? "hasn't" : "haven't"} been
            checked.{" "}
            <Link href={cashHref} className="font-semibold text-brand underline">
              See all under No card / cash
            </Link>
          </p>
        )}

        <p className="pt-2 text-center text-sm text-ink/70">
          {withCard ? "Sorted by how sure we are, then distance" : "Sorted by today's status, then distance"} ·{" "}
          <Link href="/how-we-check" className="font-semibold text-brand underline">
            How Veriq checks
          </Link>
        </p>
      </main>
    </div>
  );
}

function BrokenSearch() {
  return (
    <main className="px-4 pt-6">
      <h1 className="text-2xl font-extrabold">Results</h1>
      <p className="mt-2 text-ink/80">We couldn&apos;t read this search. Please start again.</p>
      <Link
        href="/find"
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 font-bold text-white"
      >
        Find care
      </Link>
    </main>
  );
}
