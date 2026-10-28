// Rules D1–D3 (the directory of real facilities), R1 (reports on real facilities) and rule 1 (the
// SAMPLE DATA tag). Rule 5: only source, type, location and distance are read here.
import { haversineKm, roundKm, type LatLng } from "@/lib/geo";

export type FacilitySource = "nhia" | "demo";
export type LocationSource = "osm" | "admin" | "none";

const SOURCE_NAME: Record<Exclude<FacilitySource, "demo">, string> = { nhia: "the NHIA list" };

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * rule D1: every directory fact names its source and month, "From the NHIA list, October 2026".
 * Demo facilities have none (they carry the SAMPLE DATA tag instead, rule 1).
 */
export function sourceLine(f: { source: FacilitySource; source_date: string | null }): string | null {
  if (f.source === "demo") return null;
  const list = `From ${SOURCE_NAME[f.source]}`;
  // No date in the file means no month on screen: a month is never made up.
  return f.source_date ? `${list}, ${MONTH.format(new Date(`${f.source_date.slice(0, 10)}T00:00:00Z`))}` : list;
}

/** rule D1: a facility with location_source = none is left out of every distance search and emergency mode. */
export function hasLocation(f: { location_source: LocationSource; lat: number | null; lng: number | null }): boolean {
  return f.location_source !== "none" && f.lat !== null && f.lng !== null;
}

/**
 * rule D2: demo facilities show only in demo mode (the demo login cookie or ?demo=1). Demo mode
 * shows the demo story alone, so invented and real hospitals never share a screen (team decision
 * 2026-10-26, docs/DECISIONS.md).
 */
export function visibleInMode(f: { source: FacilitySource }, demoMode: boolean): boolean {
  return demoMode ? f.source === "demo" : f.source !== "demo";
}

/** rule 1: the SAMPLE DATA tag shows whenever a demo facility is on the screen, and only then. */
export function showSampleTag(facilities: { source: FacilitySource }[]): boolean {
  return facilities.some((f) => f.source === "demo");
}

/** Rules D3 and S2: the NHIA file's pharmacy types. A chemical shop sells medicines, like a pharmacy. */
export function isPharmacy(nhiaType: string | null): boolean {
  return /pharmacy|chemical shop/i.test(nhiaType ?? "");
}

/** rule D3: the "Services not listed" group shows for NHIS and No card / cash, never for a private card. */
export function servicesNotListedApplies({
  cardSlug,
  insurerKind,
}: {
  cardSlug: string;
  /** null for No card / cash. */
  insurerKind: "public" | "private" | null;
}): boolean {
  if (insurerKind === null) return cardSlug === "cash";
  return insurerKind === "public" && cardSlug === "nhis";
}

export type NotListedItem = {
  id: string;
  lat: number | null;
  lng: number | null;
  source: FacilitySource;
  locationSource: LocationSource;
  /** The facility type as the file writes it. */
  nhiaType: string | null;
  /** Has any confirmed service (a facility_services row)? Then rule S1 searches it instead. */
  hasServices: boolean;
};

/** rule D3: how many cards the group shows before "Show more". */
export const NOT_LISTED_PAGE = 10;

/**
 * rule D3: real facilities with no confirmed services, within the search radius, sorted by
 * distance only. Pharmacies never appear. A service is never guessed from the facility type, so a
 * dental clinic shows for every service search. The caller shows the first NOT_LISTED_PAGE.
 */
export function servicesNotListed<T extends NotListedItem>(
  items: T[],
  { origin, radiusKm }: { origin: LatLng; radiusKm: number },
): (T & { distanceKm: number })[] {
  return items
    .filter((item) => item.source !== "demo" && !item.hasServices && !isPharmacy(item.nhiaType))
    .flatMap((item) =>
      hasLocation({ location_source: item.locationSource, lat: item.lat, lng: item.lng })
        ? [{ item, km: haversineKm(origin, { lat: item.lat!, lng: item.lng! }) }]
        : [],
    )
    .filter(({ km }) => km <= radiusKm)
    .sort((a, b) => a.km - b.km || a.item.id.localeCompare(b.item.id))
    .map(({ item, km }) => ({ ...item, distanceKm: roundKm(km) }));
}

/**
 * rule R1: REPORTS_LIVE turns on only after the Data Protection Commission registration. Anything
 * but "on" counts as off, so reports never open by mistake.
 */
export function reportsLive(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "on";
}

/** rule R1: reports on real facilities are closed while REPORTS_LIVE is off. Demo facilities keep reporting. */
export function reportsOpen(f: { source: FacilitySource }, live: boolean): boolean {
  return f.source === "demo" || live;
}

/** rule R1: what the report screen and USSD say while reports are closed. */
export const REPORTS_CLOSED_TEXT = "Reporting opens soon. Call the hospital to check your card.";

/**
 * rule D2: ?demo=1 works only on the demo site, in local data mode (tests) and in development, never
 * on the real site (team decision 2026-10-28).
 */
export function demoParamAllowed({ demoSite, localData, development }: { demoSite: boolean; localData: boolean; development: boolean }): boolean {
  return demoSite || localData || development;
}

/**
 * rule D2: is demo mode on? Where the parameter is allowed (demoParamAllowed), ?demo=1 turns it on and
 * ?demo=0 off, for this page and (through the veriq_demo cookie that proxy.ts sets) the screens after
 * it. A demo login cookie also turns it on (the demo login is off on the real site, DEMO_LOGIN=off).
 */
export function demoModeFrom({
  param,
  demoCookie,
  staffSignedIn,
  demoSite,
  paramAllowed,
}: {
  /** The ?demo= value on this request. */
  param: string | undefined;
  /** The veriq_demo cookie. */
  demoCookie: string | undefined;
  /** A valid demo login cookie (veriq_staff). */
  staffSignedIn: boolean;
  /** The demo deployment (VERIQ_DEMO_SITE=on): demo mode unless someone turned it off. */
  demoSite?: boolean;
  /** demoParamAllowed: false on the real site, where ?demo=1 and its cookie change nothing. */
  paramAllowed: boolean;
}): boolean {
  if (paramAllowed) {
    if (param === "1") return true;
    if (param === "0") return false;
    if (demoCookie === "1") return true;
  }
  if (staffSignedIn) return true;
  // On the demo deployment, ?demo=0 leaves a "0" cookie so later screens stay real.
  return Boolean(demoSite) && demoCookie !== "0";
}
