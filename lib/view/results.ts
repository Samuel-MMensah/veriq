// Screen 2: turns search candidates into result cards using rules B, F, T, S1 and D3 from lib/rules.
// No ranking or badge logic lives here (rule 6).
import type { LocatedFacility, SearchCandidate, UnlistedCandidate } from "@/lib/db/queries";
import type { LatLng } from "@/lib/geo";
import { badge, type Badge } from "@/lib/rules/badge";
import { servicesNotListed, sourceLine, type FacilitySource } from "@/lib/rules/directory";
import { hadConfirmedResult } from "@/lib/rules/kpi";
import { bestStatus, sortNoCard, sortResults } from "@/lib/rules/sort";
import { topUps } from "@/lib/rules/topup";
import { displayName, displayPlace } from "./names";
import { statusView, type StatusView } from "./status";
import { phoneSourceText } from "./phone";

export type ResultCard = {
  id: string;
  name: string;
  /** The neighbourhood, e.g. "Kaneshie", or null when the source doesn't say. */
  area: string | null;
  distanceKm: number;
  /** Rule D1: "From the NHIA list, October 2026" for a real facility; null for a demo one. */
  sourceLine: string | null;
  /** "demo" shows the SAMPLE DATA tag (rule 1). */
  source: FacilitySource;
  /** To call ahead, or null when we have no number. */
  phone: string | null;
  /** Rule 4: "Veriq call, 28 Oct 2026" beside the Call button, or null. */
  phoneSource: string | null;
  /** The badge says "Call first" (rule B4): the card offers a Call button. */
  callFirst: boolean;
  /** null for "No card/cash". */
  badge: Badge | null;
  /** The searched service shown, e.g. "Ultrasound scan": the one with the best status today (rule S1). */
  serviceName: string;
  status: StatusView;
  usualHours: string | null;
  /** Rule T lines, e.g. "Scan top-up about GH¢ 80 (3 patients, last 60 days)". */
  topUps: string[];
};

export type Results = {
  cards: ResultCard[];
  /** Facilities in the radius left out because the card's badge is B2x or B5. */
  hiddenCount: number;
  /** Rule K: did this search find a B2 or B3 hospital within 5 km? */
  hadConfirmedResult: boolean;
};

export function buildResults({
  candidates,
  serviceNames,
  withCard,
  origin,
  radiusKm,
  now,
}: {
  candidates: SearchCandidate[];
  /** Service id to name, e.g. ultrasound to "Ultrasound scan". */
  serviceNames: Map<string, string>;
  /** false for "No card/cash". */
  withCard: boolean;
  origin: LatLng;
  radiusKm: number;
  now: Date;
}): Results {
  const items = candidates.flatMap((c) => {
    // rule S1: today's status for the search is the best of the facility's matching services.
    const shown = bestStatus(
      c.services.map((s) => ({
        ...s,
        status: s.status?.status ?? null,
        statusUpdatedAt: s.status?.created_at ?? null,
        statusUntil: s.status?.until_time ?? null,
        row: s.status,
      })),
      now,
    );
    if (!shown) return [];
    return [
      {
        id: c.facility.id,
        lat: c.facility.lat,
        lng: c.facility.lng,
        candidate: c,
        shown,
        status: shown.status,
        statusUpdatedAt: shown.statusUpdatedAt,
        statusUntil: shown.statusUntil,
        badgeResult: withCard ? badge({ link: c.link, reports: c.reports, now }) : null,
      },
    ];
  });

  const toCard = (r: (typeof items)[number] & { distanceKm: number }): ResultCard => ({
    id: r.id,
    name: displayName(r.candidate.facility.name),
    area: displayPlace(r.candidate.facility.area),
    distanceKm: r.distanceKm,
    sourceLine: sourceLine(r.candidate.facility),
    source: r.candidate.facility.source,
    phone: r.candidate.facility.phone,
    phoneSource: phoneSourceText(r.candidate.facility),
    callFirst: r.badgeResult?.id === "B4",
    badge: r.badgeResult,
    serviceName: serviceNames.get(r.shown.serviceId) ?? r.shown.serviceId,
    status: statusView(r.shown.row, now),
    usualHours: r.shown.usualHours,
    topUps: withCard ? topUps({ reports: r.candidate.reports, responses: r.candidate.responses, now }).map((t) => t.text) : [],
  });

  if (!withCard) {
    const sorted = sortNoCard(items, { origin, radiusKm, now });
    return { cards: sorted.map(toCard), hiddenCount: 0, hadConfirmedResult: false };
  }

  // rule S1: within the radius, badges B1 to B4 only, in badge, status, distance order.
  const withBadge = items.map((i) => ({ ...i, badge: i.badgeResult!.id }));
  const sorted = sortResults(withBadge, { origin, radiusKm, now });
  const inRadius = sortNoCard(items, { origin, radiusKm, now }).length;
  return {
    cards: sorted.map(toCard),
    hiddenCount: inRadius - sorted.length,
    hadConfirmedResult: hadConfirmedResult(sorted),
  };
}

/** A rule D3 card: no service information, so no status line; the NHIA type as the file writes it. */
export type UnlistedCard = {
  id: string;
  name: string;
  area: string | null;
  distanceKm: number;
  /** As the file writes it, e.g. "CLINIC", "POLY2005" (rule D3). */
  nhiaType: string | null;
  /** Rule B for NHIS (B4 for an NHIA listing); null for No card / cash. */
  badge: Badge | null;
  /** Rule D1: "From the NHIA list, October 2026". */
  sourceLine: string | null;
  phone: string | null;
  /** Rule 4: "Veriq call, 28 Oct 2026" beside the Call button, or null. */
  phoneSource: string | null;
};

const unlistedCard = (f: LocatedFacility, distanceKm: number, b: Badge | null): UnlistedCard => ({
  id: f.id,
  name: displayName(f.name),
  area: displayPlace(f.area),
  distanceKm,
  nhiaType: f.nhia_type,
  badge: b,
  sourceLine: sourceLine(f),
  phone: f.phone,
  phoneSource: phoneSourceText(f),
});

/**
 * Rule D3: "Services not listed. Call to ask". Real facilities with no confirmed services in the
 * radius, by distance only, pharmacies left out. The caller decides whether the group applies
 * (servicesNotListedApplies) and shows the first NOT_LISTED_PAGE.
 */
export function buildNotListed({
  candidates,
  withCard,
  origin,
  radiusKm,
  now,
}: {
  candidates: UnlistedCandidate[];
  /** true for NHIS: each card shows its rule B badge. */
  withCard: boolean;
  origin: LatLng;
  radiusKm: number;
  now: Date;
}): UnlistedCard[] {
  const items = candidates.map((c) => ({
    id: c.facility.id,
    lat: c.facility.lat,
    lng: c.facility.lng,
    source: c.facility.source,
    locationSource: c.facility.location_source,
    nhiaType: c.facility.nhia_type,
    hasServices: c.hasServices,
    candidate: c,
  }));
  return servicesNotListed(items, { origin, radiusKm }).map((r) =>
    unlistedCard(r.candidate.facility, r.distanceKm, withCard ? badge({ link: r.candidate.link, reports: r.candidate.reports, now }) : null),
  );
}
