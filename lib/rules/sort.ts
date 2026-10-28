// Rules S1 (results order) and S2 (emergency order).
// Rule 5: only badge, status, time and position are read. Other fields ride along untouched.
import type { ServiceStatus } from "@/lib/db/types";
import { haversineKm, roundKm, type LatLng } from "@/lib/geo";
import type { BadgeId } from "./badge";
import { isPharmacy, type FacilitySource } from "./directory";
import { freshness } from "./freshness";

export type ResultItem = LatLng & {
  id: string;
  badge: BadgeId;
  /** Newest status for the searched service, or null if never updated. */
  status: ServiceStatus | null;
  statusUpdatedAt: string | null;
  /** The row's until_time, "HH:MM:SS" (rule F). */
  statusUntil?: string | null;
};

export type EmergencyItem = LatLng & {
  id: string;
  status: ServiceStatus | null;
  statusUpdatedAt: string | null;
  statusUntil?: string | null;
};

export type Sorted<T> = T & { distanceKm: number; statusRank: number };

// rule S1: B2, then B-V (a Veriq call), B3, B4, and B1 last. B2x, BVx and B5 never reach here.
const BADGE_ORDER: Partial<Record<BadgeId, number>> = { B2: 0, BV: 1, B3: 2, B4: 3, B1: 4 };
const GOOD: ServiceStatus[] = ["open", "accepting", "working", "from_time"];
const BAD: ServiceStatus[] = ["closed", "full", "down"];

/**
 * 0 open or accepting, 1 unknown, 2 closed or full. Over 72 hours old, or past its until_time,
 * counts as unknown (rule F).
 */
function statusRank(status: ServiceStatus | null, updatedAt: string | null, now: Date, until: string | null = null): number {
  if (!status || !updatedAt) return 1;
  const state = freshness({ created_at: updatedAt, until_time: until }, now).state;
  if (state === "stale" || state === "ended") return 1;
  if (GOOD.includes(status)) return 0;
  if (BAD.includes(status)) return 2;
  return 1;
}

export type ServiceStatusEntry = {
  serviceId: string;
  status: ServiceStatus | null;
  statusUpdatedAt: string | null;
  statusUntil?: string | null;
};

/** Which status to show: good first, then a known bad one, then unknown (a known fact beats "no update"). */
const SHOW_ORDER = [0, 2, 1];

/**
 * rule S1 for a search across several services (e.g. Scan / X-ray): the status shown, and then
 * sorted on, is the best known one (open or accepting, then closed or full, then unknown or over
 * 72 hours old), the newest among equals.
 */
export function bestStatus<T extends ServiceStatusEntry>(entries: T[], now: Date): T | null {
  const ranked = entries.map((e) => ({ e, rank: SHOW_ORDER.indexOf(statusRank(e.status, e.statusUpdatedAt, now, e.statusUntil)) }));
  ranked.sort((a, b) => a.rank - b.rank || (b.e.statusUpdatedAt ?? "").localeCompare(a.e.statusUpdatedAt ?? ""));
  return ranked[0]?.e ?? null;
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
    .map(({ item, km }) => ({ ...item, distanceKm: km, statusRank: statusRank(item.status, item.statusUpdatedAt, now, item.statusUntil) }))
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
    .map(({ item, km }) => ({ ...item, distanceKm: km, statusRank: statusRank(item.status, item.statusUpdatedAt, now, item.statusUntil) }))
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
    .map(({ item, km }) => ({ ...item, distanceKm: km, statusRank: statusRank(item.status, item.statusUpdatedAt, now, item.statusUntil) }))
    .sort(byRankThenDistance(() => 0))
    .map((r) => ({ ...r, distanceKm: roundKm(r.distanceKm) }));
}

/** A real facility for the rule S2 addition. lat and lng are null when it has no location (rule D1). */
export type NotCheckedItem = {
  id: string;
  lat: number | null;
  lng: number | null;
  source: FacilitySource;
  /** The facility type as the NHIA file writes it. */
  nhiaType: string | null;
  /** Has a row for the emergency service with a status: then rule S2 sorts it with the others. */
  hasEmergencyStatus: boolean;
};

/**
 * Rule S2 addition: is this NHIA type a hospital or polyclinic? The file writes "PRIMARY HOSPITAL",
 * "SECONDARY HOSPITAL" and "POLY2005" (polyclinics). Only the type decides, never the name.
 */
export function isHospitalOrPolyclinic(nhiaType: string | null): boolean {
  if (isPharmacy(nhiaType)) return false;
  return /hospital|poly/i.test(nhiaType ?? "");
}

/**
 * rule S2 addition: real hospitals and polyclinics within 15 km with no emergency status, listed
 * after the units with one as "Emergency not checked. Call first", sorted by distance. Pharmacies,
 * clinics and facilities with no location are left out (rule D1). No card field is read (rule 3).
 */
export function emergencyNotChecked<T extends NotCheckedItem>(
  items: T[],
  { origin, radiusKm = EMERGENCY_RADIUS_KM }: { origin: LatLng; radiusKm?: number },
): (T & { distanceKm: number })[] {
  return items
    .filter((item) => item.source !== "demo" && !item.hasEmergencyStatus && isHospitalOrPolyclinic(item.nhiaType))
    .flatMap((item) => (item.lat === null || item.lng === null ? [] : [{ item, km: haversineKm(origin, { lat: item.lat, lng: item.lng }) }]))
    .filter(({ km }) => km <= radiusKm)
    .sort((a, b) => a.km - b.km || a.item.id.localeCompare(b.item.id))
    .map(({ item, km }) => ({ ...item, distanceKm: roundKm(km) }));
}
