// /admin "Needs a location": reads a location an admin types or pastes, e.g. "5.5612, -0.2601" as
// copied from a map. Rule D1: it is stored with location_source = admin, never as OpenStreetMap.

/** Greater Accra with a margin: a typed point outside it is a mistake (swapped or missing minus). */
const REGION = { minLat: 5.4, maxLat: 6.2, minLng: -0.6, maxLng: 0.8 };

export type ParsedLocation = { ok: true; lat: number; lng: number } | { ok: false; message: string };

export function parseLocation(text: string): ParsedLocation {
  const parts = text
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (parts.length !== 2) return { ok: false, message: "Type two numbers: latitude, longitude (e.g. 5.5612, -0.2601)." };
  const [lat, lng] = parts.map(Number) as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, message: "Those aren't numbers." };
  if (lat < REGION.minLat || lat > REGION.maxLat || lng < REGION.minLng || lng > REGION.maxLng) {
    return { ok: false, message: "That point is outside Greater Accra. Check the order and the minus sign." };
  }
  return { ok: true, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}
