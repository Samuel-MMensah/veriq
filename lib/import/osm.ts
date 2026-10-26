// Prompt 9: finds each NHIA facility on OpenStreetMap by name and district. Map data © OpenStreetMap
// contributors, ODbL (data/nhia/SOURCE.md). A location is stored (location_source = osm) only for a
// confident match; anything less is "none", and the facility is listed on /admin under
// "Needs a location" (rule D1). Imports use .ts extensions for `node scripts/import-nhia.ts`.
import { haversineKm } from "../geo.ts";

export type OsmPlace = {
  /** "node/123", "way/456". */
  osm: string;
  name: string;
  lat: number;
  lng: number;
};

type Box = { minLat: number; maxLat: number; minLng: number; maxLng: number };

/**
 * The NHIA file uses the old district names (before the 2012 and 2018 splits). Each box is drawn
 * generously round the old district, so a facility's own place is never left out; a box only has to
 * rule out a namesake in another part of the region. Team decision 2026-10-26 (docs/DECISIONS.md).
 */
export const DISTRICT_AREAS: Record<string, Box> = {
  ABLEKUMA: { minLat: 5.5, maxLat: 5.62, minLng: -0.34, maxLng: -0.21 },
  "ASHIEDU KETEKE": { minLat: 5.52, maxLat: 5.58, minLng: -0.235, maxLng: -0.19 },
  OKAIKOI: { minLat: 5.55, maxLat: 5.67, minLng: -0.29, maxLng: -0.19 },
  AYAWASO: { minLat: 5.55, maxLat: 5.71, minLng: -0.24, maxLng: -0.13 },
  "OSU KLOTTEY": { minLat: 5.53, maxLat: 5.6, minLng: -0.225, maxLng: -0.16 },
  KPESHIE: { minLat: 5.54, maxLat: 5.67, minLng: -0.2, maxLng: -0.04 },
  GA: { minLat: 5.5, maxLat: 5.9, minLng: -0.5, maxLng: -0.08 },
  "TEMA MUNICIPAL": { minLat: 5.6, maxLat: 5.77, minLng: -0.11, maxLng: 0.07 },
  "DANGME WEST": { minLat: 5.62, maxLat: 6.06, minLng: -0.2, maxLng: 0.26 },
  "DANGME EAST": { minLat: 5.7, maxLat: 6.16, minLng: 0.1, maxLng: 0.76 },
};

/** Two places with the same name closer than this are the same place mapped twice. */
const SAME_PLACE_KM = 0.3;

/** Words that say what a place is, not which one. A name made only of these is never matched. */
const GENERIC = new Set(
  "AND CARE CENTRE CHEMIST CLINIC COMMUNITY DENTAL DIAGNOSTIC FAMILY HEALTH HOME HOSPITAL LAB LABORATORY MATERNITY MEDICAL PHARMACY SERVICES".split(" "),
);

/** Upper case, "&" as AND, CENTER as CENTRE, ST as SAINT, no punctuation, LTD and THE dropped. */
export function normalizeName(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[’'`]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => (w === "CENTER" ? "CENTRE" : w === "ST" ? "SAINT" : w))
    .filter((w) => !["LTD", "LIMITED", "THE", "CO"].includes(w));
  return words.join(" ");
}

export type LocationMatch =
  | { location_source: "osm"; lat: number; lng: number; osm: string }
  | { location_source: "none"; reason: string };

const inBox = (p: { lat: number; lng: number }, b: Box) =>
  p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng;

export type OsmIndex = Map<string, OsmPlace[]>;

export function indexPlaces(places: OsmPlace[]): OsmIndex {
  const index: OsmIndex = new Map();
  for (const p of places) {
    const key = normalizeName(p.name);
    if (!key) continue;
    index.set(key, [...(index.get(key) ?? []), p]);
  }
  return index;
}

/** One facility: the same name, inside its district, and only one such place. */
export function matchOne(f: { name: string; district: string }, index: OsmIndex): LocationMatch {
  const box = DISTRICT_AREAS[f.district.toUpperCase()];
  if (!box) return { location_source: "none", reason: `district "${f.district}" has no map area` };
  const key = normalizeName(f.name);
  if (key.split(" ").every((w) => GENERIC.has(w))) return { location_source: "none", reason: "name too general to match" };
  const named = index.get(key) ?? [];
  if (named.length === 0) return { location_source: "none", reason: "not on OpenStreetMap by this name" };
  const inside = named.filter((p) => inBox(p, box));
  if (inside.length === 0) return { location_source: "none", reason: "on OpenStreetMap only outside its district" };
  const first = inside[0]!;
  if (inside.some((p) => haversineKm(p, first) > SAME_PLACE_KM)) {
    return { location_source: "none", reason: `${inside.length} places with this name in its district` };
  }
  return { location_source: "osm", lat: first.lat, lng: first.lng, osm: first.osm };
}

/**
 * Every facility. When one map place matches two facilities, neither is confident: both get "none".
 */
export function matchAll<T extends { name: string; district: string }>(facilities: T[], places: OsmPlace[]): LocationMatch[] {
  const index = indexPlaces(places);
  const matches = facilities.map((f) => matchOne(f, index));
  const claims = new Map<string, number>();
  for (const m of matches) if (m.location_source === "osm") claims.set(m.osm, (claims.get(m.osm) ?? 0) + 1);
  return matches.map((m) =>
    m.location_source === "osm" && claims.get(m.osm)! > 1
      ? { location_source: "none", reason: "the same map place matches another facility" }
      : m,
  );
}
