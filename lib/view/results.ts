// Screen 2: turns search candidates into result cards using rules B, F, T and S1 from lib/rules.
// No ranking or badge logic lives here (rule 6).
import type { SearchCandidate } from "@/lib/db/queries";
import type { LatLng } from "@/lib/geo";
import { badge, type Badge } from "@/lib/rules/badge";
import { hadConfirmedResult } from "@/lib/rules/kpi";
import { sortNoCard, sortResults } from "@/lib/rules/sort";
import { topUps } from "@/lib/rules/topup";
import { statusView, type StatusView } from "./status";

export type ResultCard = {
  id: string;
  name: string;
  distanceKm: number;
  /** null for "No card/cash". */
  badge: Badge | null;
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
  withCard,
  origin,
  radiusKm,
  now,
}: {
  candidates: SearchCandidate[];
  /** false for "No card/cash". */
  withCard: boolean;
  origin: LatLng;
  radiusKm: number;
  now: Date;
}): Results {
  const items = candidates.map((c) => ({
    id: c.facility.id,
    lat: c.facility.lat,
    lng: c.facility.lng,
    candidate: c,
    status: c.status?.status ?? null,
    statusUpdatedAt: c.status?.created_at ?? null,
    badgeResult: withCard ? badge({ link: c.link, reports: c.reports, now }) : null,
  }));

  const toCard = (r: (typeof items)[number] & { distanceKm: number }): ResultCard => ({
    id: r.id,
    name: r.candidate.facility.name,
    distanceKm: r.distanceKm,
    badge: r.badgeResult,
    status: statusView(r.candidate.status, now),
    usualHours: r.candidate.usualHours,
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
