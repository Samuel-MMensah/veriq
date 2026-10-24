// Screen 6: emergency units, ordered by rule S2 only. Rule 3: the card never hides or reorders a
// hospital, so buildEmergency takes no card input at all. Saved cards are added on the phone
// afterwards as information (cardNote).
import type { EmergencyCandidate } from "@/lib/db/queries";
import type { InsurerRow } from "@/lib/db/types";
import type { LatLng } from "@/lib/geo";
import { badge, type BadgeId } from "@/lib/rules/badge";
import { sortEmergency } from "@/lib/rules/sort";
import { directionsUrl } from "./facility";
import { statusView, type StatusView } from "./status";

export type EmergencyUnit = {
  id: string;
  name: string;
  distanceKm: number;
  status: StatusView;
  directionsUrl: string;
  /** Badge per card slug at this hospital, for information only. */
  cardBadges: Record<string, BadgeId>;
};

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
      candidate: c,
    })),
    { origin, now },
  );

  return sorted.map((s) => {
    const c = s.candidate;
    const cardBadges: Record<string, BadgeId> = {};
    const insurerIds = new Set([...c.links.map((l) => l.insurer_id), ...c.reports.map((r) => r.insurer_id)]);
    for (const insurerId of insurerIds) {
      const slug = slugOf.get(insurerId);
      if (!slug) continue;
      const link = c.links.find((l) => l.insurer_id === insurerId) ?? null;
      cardBadges[slug] = badge({ link, reports: c.reports.filter((r) => r.insurer_id === insurerId), now }).id;
    }
    return {
      id: c.facility.id,
      name: c.facility.name,
      distanceKm: s.distanceKm,
      status: statusView(c.status, now),
      directionsUrl: directionsUrl(c.facility),
      cardBadges,
    };
  });
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
  const takes = savedSlugs.filter((s) => cardBadges[s] === "B2" || cardBadges[s] === "B3");
  const rest = savedSlugs.filter((s) => !takes.includes(s));
  const parts: string[] = [];
  if (takes.length) parts.push(`Takes your ${join(takes.map(name))} ${takes.length === 1 ? "card" : "cards"}`);
  for (const s of rest) {
    const b = cardBadges[s];
    parts.push(
      b === "B1" ? `${name(s)} reported refused` : b === "B2x" ? `${name(s)} not accepted` : `${name(s)} not checked`,
    );
  }
  return parts.join(" · ");
}
