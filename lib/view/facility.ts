// Screen 3: the hospital page, built from getFacilityDetail with rules B, F and T.
import type { FacilityDetail } from "@/lib/db/queries";
import type { FacilityType, InsurerRow } from "@/lib/db/types";
import { haversineKm, roundKm, type LatLng } from "@/lib/geo";
import { badge, type Badge, type BadgeId } from "@/lib/rules/badge";
import { formatAge, ageMs } from "@/lib/rules/time";
import { topUps } from "@/lib/rules/topup";
import { SOURCE_LABEL, accraClock, statusView, type StatusView } from "./status";

export const TYPE_LABEL: Record<FacilityType, string> = {
  public: "Public",
  mission: "Mission",
  private: "Private",
  quasi: "Quasi-government",
};

export type TodayTile = { serviceId: string; label: string; status: StatusView; usualHours: string | null };

export type CardRow = {
  insurer: InsurerRow;
  badge: Badge;
  /** Short answer on the right: Yes, Unsure, Refused, No or Unknown. */
  answer: "Yes" | "Unsure" | "Refused" | "No" | "Unknown";
  topUps: string[];
};

export type FacilityView = {
  id: string;
  name: string;
  /** "Mission · Kaneshie · 1.8 km" */
  subtitle: string;
  phone: string | null;
  directionsUrl: string;
  /** "Updated by hospital 7:40 am", or null when no service has an update. */
  todayUpdated: string | null;
  today: TodayTile[];
  cards: CardRow[];
};

const ANSWER: Record<BadgeId, CardRow["answer"]> = {
  B2: "Yes",
  B3: "Yes",
  B4: "Unsure",
  B1: "Refused",
  B2x: "No",
  B5: "Unknown",
};
const STRENGTH: Record<BadgeId, number> = { B2: 0, B3: 1, B4: 2, B1: 3, B2x: 4, B5: 5 };

export function directionsUrl(to: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}`;
}

export function buildFacilityView({
  detail,
  insurers,
  origin,
  cardSlug,
  now,
}: {
  detail: FacilityDetail;
  insurers: InsurerRow[];
  origin: LatLng | null;
  /** The card the person searched with; shown first. */
  cardSlug: string | null;
  now: Date;
}): FacilityView {
  const f = detail.facility;
  const distance = origin ? `${roundKm(haversineKm(origin, f))} km` : null;

  const statusBy = new Map(detail.statuses.map((s) => [s.service_id, s]));
  const today = detail.services
    .map((s) => ({
      serviceId: s.service_id,
      label: s.service?.name ?? s.service_id,
      status: statusView(statusBy.get(s.service_id) ?? null, now),
      usualHours: s.usual_hours,
    }))
    // Services with an update first, then by name.
    .sort((a, b) => Number(a.status.freshness.state === "none") - Number(b.status.freshness.state === "none") || a.label.localeCompare(b.label));

  const newest = [...detail.statuses].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const todayUpdated = newest
    ? `Updated by ${SOURCE_LABEL[newest.source]} ${
        ageMs(newest.created_at, now) < 12 * 60 * 60 * 1000 ? accraClock(newest.created_at) : `${formatAge(ageMs(newest.created_at, now))} ago`
      }`
    : null;

  // Every card with a row or a report at this facility.
  const insurerIds = new Set([...detail.links.map((l) => l.insurer_id), ...detail.reports.map((r) => r.insurer_id)]);
  const cards = insurers
    .filter((i) => insurerIds.has(i.id))
    .map((insurer): CardRow => {
      const link = detail.links.find((l) => l.insurer_id === insurer.id) ?? null;
      const reports = detail.reports.filter((r) => r.insurer_id === insurer.id);
      const responses = detail.responses.filter((r) => r.insurer_id === insurer.id);
      const b = badge({ link, reports, now });
      return { insurer, badge: b, answer: ANSWER[b.id], topUps: topUps({ reports, responses, now }).map((t) => t.text) };
    })
    .sort(
      (a, b) =>
        Number(b.insurer.slug === cardSlug) - Number(a.insurer.slug === cardSlug) ||
        STRENGTH[a.badge.id] - STRENGTH[b.badge.id] ||
        a.insurer.name.localeCompare(b.insurer.name),
    );

  return {
    id: f.id,
    name: f.name,
    subtitle: [TYPE_LABEL[f.type], f.area, distance].filter(Boolean).join(" · "),
    phone: f.phone,
    directionsUrl: directionsUrl(f),
    todayUpdated,
    today,
    cards,
  };
}
