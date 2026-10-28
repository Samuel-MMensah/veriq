// Screen 6: emergency units, ordered by rule S2 only. Rule 3: the card never hides or reorders a
// hospital, so buildEmergency takes no card input at all. Saved cards are added on the phone
// afterwards as information (cardNote).
import type { EmergencyCandidate, NotCheckedCandidate } from "@/lib/db/queries";
import type { FacilityInsurerRow, InsurerRow, PublicReportRow } from "@/lib/db/types";
import type { LatLng } from "@/lib/geo";
import { badge, type BadgeId } from "@/lib/rules/badge";
import { sourceLine } from "@/lib/rules/directory";
import { emergencyNotChecked, sortEmergency } from "@/lib/rules/sort";
import { directionsUrl } from "./facility";
import { displayName } from "./names";
import { statusView, type StatusView } from "./status";
import { phoneSourceText } from "./phone";

export type EmergencyUnit = {
  id: string;
  name: string;
  distanceKm: number;
  status: StatusView;
  /** To call ahead, "+233 …", or null when we have no number. */
  phone: string | null;
  /** Rule 4: "Veriq call, 28 Oct 2026" beside the Call button, or null. */
  phoneSource: string | null;
  directionsUrl: string;
  /** Badge per card slug at this hospital, for information only. */
  cardBadges: Record<string, BadgeId>;
  /** Rule D1: "From the NHIA list, October 2026" for a real facility; null for a demo one. */
  sourceLine: string | null;
};

/** Rule S2 addition: a real hospital or polyclinic with no emergency status. */
export type NotCheckedUnit = Omit<EmergencyUnit, "status"> & {
  /** As the file writes it, e.g. "PRIMARY HOSPITAL". */
  nhiaType: string | null;
};

/** The badge of every card with a row or a report here, for information only (rules 3 and S2). */
function badgesBySlug(
  c: { links: FacilityInsurerRow[]; reports: PublicReportRow[] },
  slugOf: Map<string, string>,
  now: Date,
): Record<string, BadgeId> {
  const cardBadges: Record<string, BadgeId> = {};
  const insurerIds = new Set([...c.links.map((l) => l.insurer_id), ...c.reports.map((r) => r.insurer_id)]);
  for (const insurerId of insurerIds) {
    const slug = slugOf.get(insurerId);
    if (!slug) continue;
    const link = c.links.find((l) => l.insurer_id === insurerId) ?? null;
    cardBadges[slug] = badge({ link, reports: c.reports.filter((r) => r.insurer_id === insurerId), now }).id;
  }
  return cardBadges;
}

export function buildEmergency({
  candidates,
  insurers,
  origin,
  now,
}: {
  candidates: EmergencyCandidate[];
  insurers: InsurerRow[];
  origin: LatLng;
  now: Date;
}): EmergencyUnit[] {
  const slugOf = new Map(insurers.map((i) => [i.id, i.slug]));
  const sorted = sortEmergency(
    candidates.map((c) => ({
      id: c.facility.id,
      lat: c.facility.lat,
      lng: c.facility.lng,
      status: c.status?.status ?? null,
      statusUpdatedAt: c.status?.created_at ?? null,
      statusUntil: c.status?.until_time ?? null,
      candidate: c,
    })),
    { origin, now },
  );

  return sorted.map((s) => {
    const c = s.candidate;
    return {
      id: c.facility.id,
      name: displayName(c.facility.name),
      distanceKm: s.distanceKm,
      status: statusView(c.status, now),
      phone: c.facility.phone,
      phoneSource: phoneSourceText(c.facility),
      directionsUrl: directionsUrl(c.facility),
      cardBadges: badgesBySlug(c, slugOf, now),
      sourceLine: sourceLine(c.facility),
    };
  });
}

/**
 * Rule S2 addition: after the units with an emergency status, real hospitals and polyclinics within
 * 15 km with none, as "Emergency not checked. Call first", by distance. No card input (rule 3).
 */
export function buildNotChecked({
  candidates,
  insurers,
  origin,
  now,
}: {
  candidates: NotCheckedCandidate[];
  insurers: InsurerRow[];
  origin: LatLng;
  now: Date;
}): NotCheckedUnit[] {
  const slugOf = new Map(insurers.map((i) => [i.id, i.slug]));
  const items = candidates.map((c) => ({
    id: c.facility.id,
    lat: c.facility.lat,
    lng: c.facility.lng,
    source: c.facility.source,
    nhiaType: c.facility.nhia_type,
    hasEmergencyStatus: c.hasEmergencyStatus,
    candidate: c,
  }));
  return emergencyNotChecked(items, { origin }).map((s) => ({
    id: s.candidate.facility.id,
    name: displayName(s.candidate.facility.name),
    distanceKm: s.distanceKm,
    phone: s.candidate.facility.phone,
    phoneSource: phoneSourceText(s.candidate.facility),
    directionsUrl: directionsUrl(s.candidate.facility),
    cardBadges: badgesBySlug(s.candidate, slugOf, now),
    sourceLine: sourceLine(s.candidate.facility),
    nhiaType: s.candidate.facility.nhia_type,
  }));
}

const join = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * What the person's saved cards mean at one hospital, in plain words. Information only: it never
 * changes which hospitals show or their order (rules 3 and S2).
 */
export function cardNote(cardBadges: Record<string, BadgeId>, savedSlugs: string[], names: Record<string, string>): string | null {
  if (savedSlugs.length === 0) return null;
  const name = (slug: string) => names[slug] ?? slug;
  // Rule B-V: a Veriq call counts as "takes" (BV) or "not accepted" (BVx), like the hospital's own answer.
  const takes = savedSlugs.filter((s) => cardBadges[s] === "B2" || cardBadges[s] === "BV" || cardBadges[s] === "B3");
  const rest = savedSlugs.filter((s) => !takes.includes(s));
  const parts: string[] = [];
  if (takes.length) parts.push(`Takes your ${join(takes.map(name))} ${takes.length === 1 ? "card" : "cards"}`);
  for (const s of rest) {
    const b = cardBadges[s];
    parts.push(
      b === "B1" ? `${name(s)} reported refused` : b === "B2x" || b === "BVx" ? `${name(s)} not accepted` : `${name(s)} not checked`,
    );
  }
  return parts.join(" · ");
}
