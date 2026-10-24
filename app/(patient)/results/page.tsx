import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { BadgeLegend } from "@/components/badges/BadgeLine";
import { ResultCardView } from "@/components/facility/ResultCardView";
import { BackLink } from "@/components/ui/BackLink";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { getInsurerBySlug, getSearchCandidates, listServices, logSearch } from "@/lib/db/queries";
import { readDb, serviceDb } from "@/lib/db/server";
import { areaCell } from "@/lib/geo";
import { CASH, RADIUS_OPTIONS_KM, cardName, parseSearch, type SearchParams } from "@/lib/view/catalog";
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
  const serviceNames = new Map(services.map((s) => [s.id, s.name]));
  const known = search.serviceIds.filter((id) => serviceNames.has(id));
  if (known.length === 0 || (withCard && !insurer)) return <BrokenSearch />;
  const serviceLabel = search.serviceLabel ?? serviceNames.get(known[0]!)!;

  const candidates = await getSearchCandidates(db, {
    serviceIds: known,
    insurerId: insurer?.id ?? null,
    lat: search.origin.lat,
    lng: search.origin.lng,
    radiusKm: search.radiusKm,
    now,
  });
  const results = buildResults({ candidates, serviceNames, withCard, origin: search.origin, radiusKm: search.radiusKm, now });

  // Rule K: count the search (card, ~2 km cell, found a confirmed hospital). Runs after the page is
  // sent, so a patient on 3G never waits for it; a failure is only logged.
  const logged = { insurerId: insurer?.id ?? null, areaCell: areaCell(search.origin.lat, search.origin.lng), hadConfirmedResult: results.hadConfirmedResult };
  after(async () => {
    try {
      await logSearch(await serviceDb(), logged);
    } catch (e) {
      console.error(e);
    }
  });

  const card = insurer?.name ?? cardName(CASH);
  const count = results.cards.length;
  const facilityQuery = `lat=${search.origin.lat}&lng=${search.origin.lng}&card=${search.card}`;
  // The same search, for "search further" and "see all under No card / cash". Keeps the area name.
  const searchQuery: Record<string, string> = {
    service: search.service,
    card: search.card,
    lat: String(search.origin.lat),
    lng: String(search.origin.lng),
    r: String(search.radiusKm),
    ...(search.areaSlug ? { area: search.areaSlug } : search.areaName === "you" ? { near: "me" } : {}),
  };
  const cashHref = `/results?${new URLSearchParams({ ...searchQuery, card: CASH })}`;

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
              {serviceLabel} · {card} · within {search.radiusKm} km
            </p>
          </div>
          <SampleDataTag className="mt-1 shrink-0" />
        </div>
      </header>

      <main className="space-y-3 px-4 py-4">
        {count > 0 &&
          (withCard ? <BadgeLegend /> : <p className="text-sm text-ink/80">Without a card, every hospital nearby is shown.</p>)}

        {count === 0 ? (
          <EmptyResults
            withCard={withCard}
            card={card}
            radiusKm={search.radiusKm}
            widerHref={(r) => `/results?${new URLSearchParams({ ...searchQuery, r: String(r) })}`}
            cashHref={withCard ? cashHref : null}
          />
        ) : (
          <ul className="space-y-3">
            {results.cards.map((c) => (
              <ResultCardView
                key={c.id}
                card={c}
                href={`/facility/${c.id}?${facilityQuery}`}
                cardName={withCard ? card : null}
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
          {/* Says what rules S1 and the no-card sort really do (rule 4). */}
          {withCard ? "Sorted by how sure we are, then today's status, then distance" : "Sorted by today's status, then distance"}{" "}
          ·{" "}
          <Link href="/how-we-check" className="font-semibold text-brand underline">
            How Veriq checks
          </Link>
        </p>
      </main>
    </div>
  );
}

/** No hospital found: offer the next step in one tap instead of a dead end. */
function EmptyResults({
  withCard,
  card,
  radiusKm,
  widerHref,
  cashHref,
}: {
  withCard: boolean;
  card: string;
  radiusKm: number;
  widerHref: (r: number) => string;
  cashHref: string | null;
}) {
  const wider = RADIUS_OPTIONS_KM.filter((r) => r > radiusKm);
  return (
    <div className="rounded-2xl bg-white p-4 text-ink/80 shadow-sm">
      <p className="font-semibold text-ink">
        No hospitals within {radiusKm} km {withCard ? `that we know take ${card}` : "offer this"}.
      </p>
      <p className="mt-1 text-sm">
        That doesn&apos;t mean none do: we may not have checked them yet. Try one of these:
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {wider.slice(0, 2).map((r) => (
          <Link
            key={r}
            href={widerHref(r)}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-4 font-bold text-white"
          >
            Search within {r} km
          </Link>
        ))}
        {cashHref && (
          <Link
            href={cashHref}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand px-4 font-bold text-brand"
          >
            See every hospital nearby
          </Link>
        )}
        <Link href="/find" className="inline-flex min-h-11 items-center justify-center font-semibold text-brand underline">
          Change the search
        </Link>
      </div>
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
