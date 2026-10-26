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

/** /admin/locations search: by facility name, district or area, ignoring case and extra spaces. */
export function matchesSearch(f: { name: string; district: string; area: string | null }, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${f.name} ${f.district} ${f.area ?? ""}`.toLowerCase();
  return words.every((w) => text.includes(w));
}

/**
 * The map preview (OpenStreetMap tiles, standard "slippy map" numbering): which tile holds a point at
 * a zoom level, and where in that tile (0 to 256 px) the point falls.
 */
export function tileFor(lat: number, lng: number, zoom: number): { x: number; y: number; px: number; py: number } {
  const n = 2 ** zoom;
  const fx = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { x: Math.floor(fx), y: Math.floor(fy), px: Math.round((fx % 1) * 256), py: Math.round((fy % 1) * 256) };
}
