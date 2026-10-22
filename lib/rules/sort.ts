// Rules S1 (results order) and S2 (emergency order).
// Rule 5: only badge, status, time and position are read. Other fields ride along untouched.
import type { ServiceStatus } from "@/lib/db/types";
import { haversineKm, roundKm, type LatLng } from "@/lib/geo";
import type { BadgeId } from "./badge";
import { freshness } from "./freshness";

export type ResultItem = LatLng & {
  id: string;
  badge: BadgeId;
  /** Newest status for the searched service, or null if never updated. */
  status: ServiceStatus | null;
  statusUpdatedAt: string | null;
};

export type EmergencyItem = LatLng & {
  id: string;
  status: ServiceStatus | null;
  statusUpdatedAt: string | null;
};

export type Sorted<T> = T & { distanceKm: number; statusRank: number };

const BADGE_ORDER: Partial<Record<BadgeId, number>> = { B2: 0, B3: 1, B4: 2, B1: 3 };
const GOOD: ServiceStatus[] = ["open", "accepting", "working", "from_time"];
const BAD: ServiceStatus[] = ["closed", "full", "down"];

/** 0 open or accepting, 1 unknown, 2 closed or full. Over 72 hours old counts as unknown (rule F). */
function statusRank(status: ServiceStatus | null, updatedAt: string | null, now: Date): number {
  if (!status || !updatedAt || freshness({ created_at: updatedAt }, now).state === "stale") return 1;
  if (GOOD.includes(status)) return 0;
  if (BAD.includes(status)) return 2;
  return 1;
}

function byRankThenDistance<T extends { id: string; distanceKm: number; statusRank: number }>(
  first: (t: T) => number,
) {
  return (a: T, b: T) =>
    first(a) - first(b) || a.statusRank - b.statusRank || a.distanceKm - b.distanceKm || a.id.localeCompare(b.id);
}

/**
 * rule S1: keep facilities within the radius whose badge is B1 to B4. Sort by badge (B2, B3, B4, then B1),
 * then today's status (open or accepting, unknown, closed or full), then straight-line distance.
 * Callers pass only facilities that offer the service.
 */
export function sortResults<T extends ResultItem>(
  items: T[],
  { origin, radiusKm, now }: { origin: LatLng; radiusKm: number; now: Date },
): Sorted<T>[] {
  return items
    .filter((item) => BADGE_ORDER[item.badge] !== undefined)
    .map((item) => ({ item, km: haversineKm(origin, item) }))
    .filter(({ km }) => km <= radiusKm)
    .map(({ item, km }) => ({ ...item, distanceKm: km, statusRank: statusRank(item.status, item.statusUpdatedAt, now) }))
    .sort(byRankThenDistance((r) => BADGE_ORDER[r.badge]!))
    .map((r) => ({ ...r, distanceKm: roundKm(r.distanceKm) }));
}

/**
 * "No card/cash" results (rule S1 without the badge step): every facility in the radius that offers
 * the service, sorted by today's status, then distance. Badges don't apply without a card.
 */
export function sortNoCard<T extends EmergencyItem>(
  items: T[],
  { origin, radiusKm, now }: { origin: LatLng; radiusKm: number; now: Date },
): Sorted<T>[] {
  return items
    .map((item) => ({ item, km: haversineKm(origin, item) }))
    .filter(({ km }) => km <= radiusKm)
    .map(({ item, km }) => ({ ...item, distanceKm: km, statusRank: statusRank(item.status, item.statusUpdatedAt, now) }))
    .sort(byRankThenDistance(() => 0))
    .map((r) => ({ ...r, distanceKm: roundKm(r.distanceKm) }));
}

export const EMERGENCY_RADIUS_KM = 15;

/**
 * rule S2: emergency units within 15 km, sorted by emergency status (accepting, then unknown or stale,
 * then full), then distance. Never filters or reorders by card (rule 3): no card field is read.
 */
export function sortEmergency<T extends EmergencyItem>(
  items: T[],
  { origin, now, radiusKm = EMERGENCY_RADIUS_KM }: { origin: LatLng; now: Date; radiusKm?: number },
): Sorted<T>[] {
  return items
    .map((item) => ({ item, km: haversineKm(origin, item) }))
    .filter(({ km }) => km <= radiusKm)
    .map(({ item, km }) => ({ ...item, distanceKm: km, statusRank: statusRank(item.status, item.statusUpdatedAt, now) }))
    .sort(byRankThenDistance(() => 0))
    .map((r) => ({ ...r, distanceKm: roundKm(r.distanceKm) }));
}
