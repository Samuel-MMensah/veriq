// Screen 3: the hospital page, built from getFacilityDetail with rules B, F and T.
import type { FacilityDetail } from "@/lib/db/queries";
import type { FacilityType, InsurerRow } from "@/lib/db/types";
import { haversineKm, roundKm, type LatLng } from "@/lib/geo";
import { badge, verdict, type Badge, type BadgeId, type Verdict } from "@/lib/rules/badge";
import { hasLocation, sourceLine } from "@/lib/rules/directory";
import { agoText, ageMs } from "@/lib/rules/time";
import { topUps } from "@/lib/rules/topup";
import { displayName, displayPlace } from "./names";
import { SOURCE_WHO, accraClock, statusView, type StatusView } from "./status";

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
  /** Short answer on the right: Yes, Unsure, Refused, No or Unknown (rule B, `verdict`). */
  answer: Verdict["short"];
  topUps: string[];
};

export type FacilityView = {
  id: string;
  name: string;
  /** "Mission · Kaneshie · 1.8 km"; for a real facility, the NHIA type, area and district. */
  subtitle: string;
  phone: string | null;
  /** null when we don't know where it is (rule D1). */
  directionsUrl: string | null;
  /** Rule D1: "From the NHIA list, October 2026"; null for a demo facility. */
  sourceLine: string | null;
  /** Where the location came from, for a real facility (rule 4), or null for a demo one. */
  locationNote: string | null;
  /** Prompt 10b, rule 4: "Phone and services: Veriq call, 28 Oct 2026", or null. */
  callNote: string | null;
  /** A real facility: no service or status is known yet unless a row says so. */
  real: boolean;
  /** "Updated by hospital 7:40 am", or null when no service has an update. */
  todayUpdated: string | null;
  today: TodayTile[];
  cards: CardRow[];
};

// Rule S1 order, with rule B-V between B2 and B3.
const STRENGTH: Record<BadgeId, number> = { B2: 0, BV: 1, B3: 2, B4: 3, B1: 4, B2x: 5, BVx: 6, B5: 7 };

const CALL_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" });

/**
 * Prompt 10b (rule 4): the facts a Veriq call gave a real facility, with the day of the call.
 * "Phone and services: Veriq call, 28 Oct 2026"; the phone from the source file says so instead.
 */
export function callNote(
  f: { phone: string | null; phone_source: string | null; phone_checked_at: string | null },
  services: { source: string | null; checked_at: string | null }[],
): string | null {
  const day = (iso: string) => CALL_DAY.format(new Date(iso));
  const phoneDay = f.phone && f.phone_source === "veriq_call" && f.phone_checked_at ? day(f.phone_checked_at) : null;
  const newest = services
    .filter((s) => s.source === "veriq_call" && s.checked_at)
    .map((s) => s.checked_at!)
    .sort()
    .at(-1);
  const servicesDay = newest ? day(newest) : null;
  const parts: string[] = [];
  if (f.phone && f.phone_source === "nhia") parts.push("Phone: NHIA list");
  if (phoneDay && phoneDay === servicesDay) parts.push(`Phone and services: Veriq call, ${phoneDay}`);
  else {
    if (phoneDay) parts.push(`Phone: Veriq call, ${phoneDay}`);
    if (servicesDay) parts.push(`Services: Veriq call, ${servicesDay}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

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
  const located = hasLocation(f) ? { lat: f.lat!, lng: f.lng! } : null;
  const distance = origin && located ? `${roundKm(haversineKm(origin, located))} km` : null;

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
    ? `${SOURCE_WHO[newest.source]} · ${
        ageMs(newest.created_at, now) < 12 * 60 * 60 * 1000 ? accraClock(newest.created_at) : agoText(ageMs(newest.created_at, now))
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
      return { insurer, badge: b, answer: verdict(b.id, insurer.name).short, topUps: topUps({ reports, responses, now }).map((t) => t.text) };
    })
    .sort(
      (a, b) =>
        Number(b.insurer.slug === cardSlug) - Number(a.insurer.slug === cardSlug) ||
        STRENGTH[a.badge.id] - STRENGTH[b.badge.id] ||
        a.insurer.name.localeCompare(b.insurer.name),
    );

  const real = f.source !== "demo";
  // Rule D1: a real facility's type is the file's own words; ownership is only shown when known.
  const kind = real ? f.nhia_type : f.type ? TYPE_LABEL[f.type] : null;
  const district = real ? displayPlace(f.district) : null;
  return {
    id: f.id,
    name: displayName(f.name),
    subtitle: [kind, displayPlace(f.area), district, distance].filter(Boolean).join(" · "),
    phone: f.phone,
    directionsUrl: located ? directionsUrl(located) : null,
    sourceLine: sourceLine(f),
    locationNote: !real
      ? null
      : f.location_source === "osm"
        ? "Map: OpenStreetMap"
        : f.location_source === "admin"
          ? "Map: Veriq"
          : "Map: not checked yet",
    callNote: real ? callNote(f, detail.services) : null,
    real,
    todayUpdated,
    today,
    cards,
  };
}
