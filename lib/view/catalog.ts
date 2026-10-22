// Fixed choices on the Find screen (SPEC section 2, screen 1) and parsing of the results URL.
import type { LatLng } from "@/lib/geo";

/** A Find chip. Its slug goes in the URL (?service=); it searches all of its services. */
export type ServiceChip = { slug: string; label: string; serviceIds: string[] };

export const SERVICE_CHIPS: ServiceChip[] = [
  { slug: "antenatal", label: "Antenatal / maternity", serviceIds: ["antenatal", "delivery", "c_section"] },
  { slug: "gp", label: "See a doctor", serviceIds: ["gp"] },
  { slug: "scan", label: "Scan / X-ray", serviceIds: ["ultrasound", "xray", "ct"] },
  { slug: "lab", label: "Lab test", serviceIds: ["lab"] },
  { slug: "specialist", label: "Specialist", serviceIds: ["obstetrician", "paediatrics"] },
  { slug: "dental", label: "Dental", serviceIds: ["dental"] },
];

export const CASH = "cash";

export type CardOption = { slug: string; name: string; note: string };

/** Saved cards come first (Prompt 6 adds them); then these, in this order. */
export const CARD_OPTIONS: CardOption[] = [
  { slug: "nhis", name: "NHIS", note: "Public" },
  { slug: "cosmopolitan", name: "Cosmopolitan Health", note: "Private" },
  { slug: "prudential", name: "Prudential", note: "Private" },
  { slug: CASH, name: "No card / cash", note: "Paying yourself" },
];

export type Area = LatLng & { slug: string; name: string };

/** Areas a person can pick when they don't share their location. Dansoman is the demo default. */
export const AREAS: Area[] = [
  { slug: "dansoman", name: "Dansoman", lat: 5.545, lng: -0.265 },
  { slug: "kaneshie", name: "Kaneshie", lat: 5.565, lng: -0.236 },
  { slug: "mataheko", name: "Mataheko", lat: 5.566, lng: -0.252 },
  { slug: "odorkor", name: "Odorkor", lat: 5.575, lng: -0.28 },
  { slug: "mamprobi", name: "Mamprobi", lat: 5.537, lng: -0.236 },
  { slug: "weija", name: "Weija", lat: 5.556, lng: -0.33 },
  { slug: "abossey-okai", name: "Abossey Okai", lat: 5.556, lng: -0.226 },
  { slug: "achimota", name: "Achimota", lat: 5.615, lng: -0.23 },
  { slug: "labadi", name: "Labadi", lat: 5.56, lng: -0.15 },
  { slug: "teshie", name: "Teshie", lat: 5.585, lng: -0.105 },
  { slug: "madina", name: "Madina", lat: 5.68, lng: -0.165 },
  { slug: "amasaman", name: "Amasaman", lat: 5.7, lng: -0.3 },
  { slug: "ashaiman", name: "Ashaiman", lat: 5.69, lng: -0.03 },
  { slug: "tema", name: "Tema", lat: 5.67, lng: -0.017 },
];

export const DEFAULT_AREA = AREAS[0]!;
export const RADIUS_OPTIONS_KM = [2, 5, 10, 15];
export const DEFAULT_RADIUS_KM = 5;

export type SearchParams = Record<string, string | string[] | undefined>;

export type ParsedSearch = {
  /** The ?service= value: a chip slug, or a single service id. */
  service: string;
  serviceIds: string[];
  /** The chip label, or null for a single service id (the page then uses the service name). */
  serviceLabel: string | null;
  card: string;
  origin: LatLng;
  /** Shown as "near {areaName}". */
  areaName: string;
  radiusKm: number;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads /results?service=&card=&lat=&lng=&r=&area=. Returns null when the link is broken. */
export function parseSearch(params: SearchParams): ParsedSearch | null {
  const service = first(params.service);
  const card = first(params.card);
  if (!service || !/^[a-z_]+$/.test(service) || !card || !/^[a-z0-9-]+$/.test(card)) return null;
  const chip = SERVICE_CHIPS.find((c) => c.slug === service);

  const lat = Number(first(params.lat));
  const lng = Number(first(params.lng));
  const area = AREAS.find((a) => a.slug === first(params.area));
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const origin = hasPoint && first(params.lat) && first(params.lng) ? { lat, lng } : area;
  if (!origin) return null;

  const r = Number(first(params.r));
  const radiusKm = RADIUS_OPTIONS_KM.includes(r) ? r : DEFAULT_RADIUS_KM;
  const areaName = area?.name ?? (first(params.near) === "me" ? "you" : "this place");
  return {
    service,
    serviceIds: chip?.serviceIds ?? [service],
    serviceLabel: chip?.label ?? null,
    card,
    origin: { lat: origin.lat, lng: origin.lng },
    areaName,
    radiusKm,
  };
}

export function cardName(slug: string): string {
  return CARD_OPTIONS.find((c) => c.slug === slug)?.name ?? slug;
}
