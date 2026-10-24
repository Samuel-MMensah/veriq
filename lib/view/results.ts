// Screen 2: turns search candidates into result cards using rules B, F, T and S1 from lib/rules.
// No ranking or badge logic lives here (rule 6).
import type { SearchCandidate } from "@/lib/db/queries";
import type { LatLng } from "@/lib/geo";
import { badge, type Badge } from "@/lib/rules/badge";
import { hadConfirmedResult } from "@/lib/rules/kpi";
import { bestStatus, sortNoCard, sortResults } from "@/lib/rules/sort";
import { topUps } from "@/lib/rules/topup";
import { statusView, type StatusView } from "./status";

export type ResultCard = {
  id: string;
  name: string;
  /** The neighbourhood, e.g. "Kaneshie". */
  area: string;
  distanceKm: number;
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
        badgeResult: withCard ? badge({ link: c.link, reports: c.reports, now }) : null,
      },
    ];
  });

  const toCard = (r: (typeof items)[number] & { distanceKm: number }): ResultCard => ({
    id: r.id,
    name: r.candidate.facility.name,
    area: r.candidate.facility.area,
    distanceKm: r.distanceKm,
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
