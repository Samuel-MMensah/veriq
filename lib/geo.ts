// Distances and area cells. Pure functions, no I/O.

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Straight-line distance in km (rules S1 and S2). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distances are shown to one decimal place (rule S1). */
export function roundKm(km: number): number {
  return Math.round(km * 10) / 10;
}

/** Cell size for rule K: 0.02 degrees, about 2 km. */
export const CELL_DEG = 0.02;
// Guards against 5.54 / 0.02 = 276.99999… putting a point on an edge into the cell below.
const EPSILON = 1e-9;

/** The south-west corner of the point's cell, written "lat,lng" with two decimals (rule K). */
export function areaCell(lat: number, lng: number): string {
  const corner = (v: number) => (Math.floor(v / CELL_DEG + EPSILON) * CELL_DEG).toFixed(2);
  return `${corner(lat)},${corner(lng)}`;
}

/** The centre of a cell written by areaCell. */
export function cellCentre(cell: string): LatLng {
  const match = /^(-?\d+\.\d{2}),(-?\d+\.\d{2})$/.exec(cell);
  if (!match) throw new Error(`Not an area cell: ${cell}`);
  return { lat: Number(match[1]) + CELL_DEG / 2, lng: Number(match[2]) + CELL_DEG / 2 };
}
