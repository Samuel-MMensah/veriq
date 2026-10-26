import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { BadgeLegend } from "@/components/badges/BadgeLine";
import { ResultCardView, UnlistedCardView } from "@/components/facility/ResultCardView";
import { BackLink } from "@/components/ui/BackLink";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { getInsurerBySlug, getSearchCandidates, getUnlistedCandidates, listServices, logSearch } from "@/lib/db/queries";
import { readDb, serviceDb } from "@/lib/db/server";
import { isDemoMode } from "@/lib/demo/mode";
import { areaCell } from "@/lib/geo";
import { NOT_LISTED_PAGE, servicesNotListedApplies, showSampleTag } from "@/lib/rules/directory";
import { CASH, RADIUS_OPTIONS_KM, cardName, parseSearch, type SearchParams } from "@/lib/view/catalog";
import { buildNotListed, buildResults } from "@/lib/view/results";

export const metadata: Metadata = { title: "Results" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ResultsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const search = parseSearch(sp);
  if (!search) return <BrokenSearch />;
  const demoMode = await isDemoMode(sp);

  const db = await readDb();
  // Read the clock once the database is ready (local mode seeds on first use).
  const now = new Date();
  const withCard = search.card !== CASH;
  const [insurer, services] = await Promise.all([withCard ? getInsurerBySlug(db, search.card) : null, listServices(db)]);
  const serviceNames = new Map(services.map((s) => [s.id, s.name]));
  const known = search.serviceIds.filter((id) => serviceNames.has(id));
  if (known.length === 0 || (withCard && !insurer)) return <BrokenSearch />;
  const serviceLabel = search.serviceLabel ?? serviceNames.get(known[0]!)!;

  const query = {
    insurerId: insurer?.id ?? null,
    lat: search.origin.lat,
    lng: search.origin.lng,
    radiusKm: search.radiusKm,
    now,
    demoMode,
  };
  // Rule D3: the "Services not listed" group, for NHIS and No card / cash only.
  const withUnlisted = servicesNotListedApplies({ cardSlug: search.card, insurerKind: insurer?.kind ?? null });
  const [candidates, unlistedCandidates] = await Promise.all([
    getSearchCandidates(db, { ...query, serviceIds: known }),
    withUnlisted ? getUnlistedCandidates(db, query) : Promise.resolve([]),
  ]);
  const results = buildResults({ candidates, serviceNames, withCard, origin: search.origin, radiusKm: search.radiusKm, now });
  const unlisted = buildNotListed({ candidates: unlistedCandidates, withCard, origin: search.origin, radiusKm: search.radiusKm, now });
  // Rule D3: the 10 nearest, then "Show more" (10 more each time).
  const pages = Math.max(1, Math.min(50, Math.floor(Number(first(sp.more)) || 1)));
  const unlistedShown = unlisted.slice(0, pages * NOT_LISTED_PAGE);

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
  const moreHref = `/results?${new URLSearchParams({ ...searchQuery, more: String(pages + 1) })}`;

  return (
    <div className="min-h-dvh bg-page">
      <header className="border-b border-line bg-surface px-4 pb-3 pt-4">
        <div className="flex items-start gap-2">
          <BackLink fallback="/find" label="Back to search" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold leading-tight">
              {count === 0 && unlisted.length > 0
                ? `Near ${search.areaName}: services not listed yet`
                : `${count} ${count === 1 ? "hospital" : "hospitals"} near ${search.areaName}`}
            </h1>
            <p className="text-sm text-muted">
              {serviceLabel} · {card} · within {search.radiusKm} km
            </p>
          </div>
          {/* Rule 1: only while a demo hospital is on the screen. */}
          {showSampleTag(results.cards) && <SampleDataTag className="mt-1 shrink-0" />}
        </div>
      </header>

      <main className="space-y-3 px-4 py-4">
        {count > 0 &&
          (withCard ? <BadgeLegend /> : <p className="text-sm text-muted">Without a card, every hospital nearby is shown.</p>)}

        {count === 0 && unlisted.length > 0 ? (
          <p className="text-muted">
            No hospital near here has told us its services yet. The places below are on the NHIA list. Call to ask
            before you go.
          </p>
        ) : count === 0 ? (
          <EmptyResults
            withCard={withCard}
            card={card}
            radiusKm={search.radiusKm}
            widerHref={(r) => `/results?${new URLSearchParams({ ...searchQuery, r: String(r) })}`}
            cashHref={withCard ? cashHref : null}
          />
        ) : (
          <ul className="space-y-3">
            {results.cards.map((c, i) => (
              <ResultCardView
                key={c.id}
                index={i}
                card={c}
                href={`/facility/${c.id}?${facilityQuery}`}
                cardName={withCard ? card : null}
              />
            ))}
          </ul>
        )}

        {unlisted.length > 0 && (
          <section aria-labelledby="not-listed" className="space-y-3 pt-2">
            <h2 id="not-listed" className="text-lg font-bold">
              Services not listed. Call to ask
            </h2>
            {/* Rule D3 sorts this group by distance only (rule 4: say how it is sorted). */}
            <p className="text-sm text-muted">Sorted by distance only. Pharmacies are not shown.</p>
            <ul className="space-y-3" aria-labelledby="not-listed">
              {unlistedShown.map((c) => (
                <UnlistedCardView
                  key={c.id}
                  card={c}
                  href={`/facility/${c.id}?${facilityQuery}`}
                  cardName={withCard ? card : null}
                />
              ))}
            </ul>
            {unlisted.length > unlistedShown.length && (
              <Button href={moreHref} variant="secondary" full>
                Show more ({unlisted.length - unlistedShown.length} more)
              </Button>
            )}
          </section>
        )}

        {results.hiddenCount > 0 && (
          <p className="text-sm text-muted">
            {results.hiddenCount} more {results.hiddenCount === 1 ? "hospital" : "hospitals"} nearby{" "}
            {results.hiddenCount === 1 ? "doesn't" : "don't"} take {card} or {results.hiddenCount === 1 ? "hasn't" : "haven't"} been
            checked.{" "}
            <Link href={cashHref} className="font-semibold text-brand underline">
              See all under No card / cash
            </Link>
          </p>
        )}

        <p className="pt-2 text-center text-sm text-muted">
          {/* Says what rules S1 and the no-card sort really do (rule 4); only when they sorted something. */}
          {count > 0 && (
            <>
              {withCard ? "Sorted by how sure we are, then today's status, then distance" : "Sorted by today's status, then distance"}{" "}
              ·{" "}
            </>
          )}
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
    <Card>
      <EmptyState icon="search" title={`No hospitals within ${radiusKm} km ${withCard ? `that we know take ${card}` : "offer this"}`}>
        That doesn&apos;t mean none do: we may not have checked them yet. Try one of these:
      </EmptyState>
      <div className="flex flex-col gap-2">
        {wider.slice(0, 2).map((r, i) => (
          <Button key={r} href={widerHref(r)} variant={i === 0 ? "primary" : "secondary"}>
            Search within {r} km
          </Button>
        ))}
        {cashHref && (
          <Button href={cashHref} variant="secondary">
            See every hospital nearby
          </Button>
        )}
        <Button href="/find" variant="quiet">
          Change the search
        </Button>
      </div>
    </Card>
  );
}

function BrokenSearch() {
  return (
    <main className="px-4 pt-10">
      <h1 className="sr-only">Results</h1>
      <EmptyState icon="search" title="We couldn't read this search" action={<Button href="/find">Find care</Button>}>
        Please start again.
      </EmptyState>
    </main>
  );
}
