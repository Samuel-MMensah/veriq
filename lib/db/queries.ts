// Typed reads for the Phase 1 screens. These only fetch rows; badges, freshness, top-ups and
// sorting are worked out from them in lib/rules (rule 6). No payment or plan field is read here (rule 5).
import type { Db } from "./supabase";
import type {
  CurrentStatusRow,
  FacilityInsurerRow,
  FacilityRow,
  FacilityServiceRow,
  HospitalResponseRow,
  InsurerRow,
  PublicReportRow,
  ReachDailyRow,
  SearchDailyRow,
  ServiceRow,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Reports and replies are fetched for 12 months: rules B and T look back 30 and 60 days, and the report
 * history covers 7 days, 30 days and 12 months (team decision 2026-10-22). */
export const REPORT_WINDOW_DAYS = 365;
/** Rule K looks back 30 days. */
export const INSURER_WINDOW_DAYS = 30;
/** Rule S2: emergency units within 15 km. */
export const EMERGENCY_RADIUS_KM = 15;

type Result<T> = { data: T | null; error: { message: string } | null };

/** A list read: throws on error. */
function rows<T>({ data, error }: Result<T[]>, what: string): T[] {
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
  return data ?? [];
}

/** A single-row read that may find nothing: throws on error. */
function maybe<T>({ data, error }: Result<T>, what: string): T | null {
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
  return data;
}

function daysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

export type BoundingBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

/**
 * A box that contains every point within radiusKm of the centre. It narrows the database read;
 * the exact distance check (haversine) happens in lib/rules.
 */
export function boundingBox(lat: number, lng: number, radiusKm: number): BoundingBox {
  const dLat = radiusKm / 111.195;
  const dLng = radiusKm / (111.195 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

// Reference lists ------------------------------------------------------------------

export async function listServices(db: Db): Promise<ServiceRow[]> {
  return rows(await db.from("services").select("*").order("name"), "services");
}

export async function listInsurers(db: Db): Promise<InsurerRow[]> {
  return rows(await db.from("insurers").select("*").order("name"), "insurers");
}

export async function getInsurerBySlug(db: Db, slug: string): Promise<InsurerRow | null> {
  return maybe<InsurerRow>(await db.from("insurers").select("*").eq("slug", slug).maybeSingle(), "insurer");
}

// Shared pieces ------------------------------------------------------------------------

async function facilitiesInBox(db: Db, box: BoundingBox): Promise<FacilityRow[]> {
  return rows(
    await db
      .from("facilities")
      .select("*")
      .gte("lat", box.minLat)
      .lte("lat", box.maxLat)
      .gte("lng", box.minLng)
      .lte("lng", box.maxLng),
    "facilities",
  );
}

async function offering(db: Db, facilityIds: string[], serviceId: string): Promise<FacilityServiceRow[]> {
  if (facilityIds.length === 0) return [];
  return rows(
    await db
      .from("facility_services")
      .select("*")
      .eq("service_id", serviceId)
      .eq("offered", true)
      .in("facility_id", facilityIds),
    "services offered",
  );
}

async function statusFor(db: Db, facilityIds: string[], serviceId?: string): Promise<CurrentStatusRow[]> {
  if (facilityIds.length === 0) return [];
  let query = db.from("current_status").select("*").in("facility_id", facilityIds);
  if (serviceId) query = query.eq("service_id", serviceId);
  return rows(await query, "status");
}

async function linksFor(db: Db, facilityIds: string[], insurerId?: string): Promise<FacilityInsurerRow[]> {
  if (facilityIds.length === 0) return [];
  let query = db.from("facility_insurers").select("*").in("facility_id", facilityIds);
  if (insurerId) query = query.eq("insurer_id", insurerId);
  return rows(await query, "card links");
}

async function reportsFor(
  db: Db,
  facilityIds: string[],
  since: string,
  insurerId?: string,
): Promise<PublicReportRow[]> {
  if (facilityIds.length === 0) return [];
  let query = db
    .from("public_card_reports")
    .select("*")
    .in("facility_id", facilityIds)
    .gte("created_at", since);
  if (insurerId) query = query.eq("insurer_id", insurerId);
  return rows(await query.order("created_at", { ascending: false }), "reports");
}

async function responsesFor(
  db: Db,
  facilityIds: string[],
  since: string,
  insurerId?: string,
): Promise<HospitalResponseRow[]> {
  if (facilityIds.length === 0) return [];
  let query = db
    .from("hospital_responses")
    .select("*")
    .in("facility_id", facilityIds)
    .gte("created_at", since);
  if (insurerId) query = query.eq("insurer_id", insurerId);
  return rows(await query.order("created_at", { ascending: false }), "hospital replies");
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

// Screen 2: results (rules B, F, T, S1) ------------------------------------------------------

export type SearchCandidate = {
  facility: FacilityRow;
  usualHours: string | null;
  /** Newest status for the searched service, or null if never updated (rule F). */
  status: CurrentStatusRow | null;
  /** The facility's row for the chosen card, or null (B5). Always null for "No card/cash". */
  link: FacilityInsurerRow | null;
  /** Live reports for the chosen card, last 12 months, newest first. */
  reports: PublicReportRow[];
  /** Hospital replies for the chosen card, last 12 months, newest first. */
  responses: HospitalResponseRow[];
};

export type SearchInput = {
  serviceId: string;
  /** null means "No card/cash". */
  insurerId: string | null;
  lat: number;
  lng: number;
  radiusKm: number;
  now: Date;
};

/** Facilities near the point that offer the service, with everything rules B, F, T and S1 need. */
export async function getSearchCandidates(db: Db, input: SearchInput): Promise<SearchCandidate[]> {
  const near = await facilitiesInBox(db, boundingBox(input.lat, input.lng, input.radiusKm));
  const offered = await offering(db, near.map((f) => f.id), input.serviceId);
  const ids = offered.map((o) => o.facility_id);
  const since = daysBefore(input.now, REPORT_WINDOW_DAYS);
  const card = input.insurerId ?? undefined;

  const [statuses, links, reports, responses] = await Promise.all([
    statusFor(db, ids, input.serviceId),
    card ? linksFor(db, ids, card) : Promise.resolve([]),
    card ? reportsFor(db, ids, since, card) : Promise.resolve([]),
    card ? responsesFor(db, ids, since, card) : Promise.resolve([]),
  ]);

  const byId = new Map(near.map((f) => [f.id, f]));
  const statusBy = new Map(statuses.map((s) => [s.facility_id, s]));
  const linkBy = new Map(links.map((l) => [l.facility_id, l]));
  const reportsBy = groupBy(reports, (r) => r.facility_id);
  const responsesBy = groupBy(responses, (r) => r.facility_id);

  return offered.flatMap((o) => {
    const facility = byId.get(o.facility_id);
    if (!facility) return [];
    return [
      {
        facility,
        usualHours: o.usual_hours,
        status: statusBy.get(o.facility_id) ?? null,
        link: linkBy.get(o.facility_id) ?? null,
        reports: reportsBy.get(o.facility_id) ?? [],
        responses: responsesBy.get(o.facility_id) ?? [],
      },
    ];
  });
}

// Screen 3: hospital detail ------------------------------------------------------------------

export type FacilityDetail = {
  facility: FacilityRow;
  services: (FacilityServiceRow & { service: ServiceRow | null })[];
  /** Newest status per service (rule F). */
  statuses: CurrentStatusRow[];
  links: (FacilityInsurerRow & { insurer: InsurerRow | null })[];
  /** Live reports for every card, last 12 months, newest first. */
  reports: PublicReportRow[];
  responses: HospitalResponseRow[];
};

export async function getFacilityDetail(db: Db, facilityId: string, now: Date): Promise<FacilityDetail | null> {
  const facility = maybe<FacilityRow>(await db.from("facilities").select("*").eq("id", facilityId).maybeSingle(), "facility");
  if (!facility) return null;
  const ids = [facility.id];
  const since = daysBefore(now, REPORT_WINDOW_DAYS);

  const [offered, services, insurers, statuses, links, reports, responses] = await Promise.all([
    db
      .from("facility_services")
      .select("*")
      .eq("facility_id", facility.id)
      .eq("offered", true)
      .then((res) => rows(res, "services offered")),
    listServices(db),
    listInsurers(db),
    statusFor(db, ids),
    linksFor(db, ids),
    reportsFor(db, ids, since),
    responsesFor(db, ids, since),
  ]);

  const serviceBy = new Map(services.map((s) => [s.id, s]));
  const insurerBy = new Map(insurers.map((i) => [i.id, i]));
  return {
    facility,
    services: offered.map((o) => ({ ...o, service: serviceBy.get(o.service_id) ?? null })),
    statuses,
    links: links.map((l) => ({ ...l, insurer: insurerBy.get(l.insurer_id) ?? null })),
    reports,
    responses,
  };
}

// Screen 6: emergency mode (rule S2) -----------------------------------------------------------

export type EmergencyCandidate = {
  facility: FacilityRow;
  /** Newest emergency status, or null (rule F). */
  status: CurrentStatusRow | null;
  /** Every card link, shown as information only. Never used to filter or order (rules 3 and S2). */
  links: FacilityInsurerRow[];
  reports: PublicReportRow[];
};

export async function getEmergencyCandidates(
  db: Db,
  input: { lat: number; lng: number; now: Date; radiusKm?: number },
): Promise<EmergencyCandidate[]> {
  const near = await facilitiesInBox(db, boundingBox(input.lat, input.lng, input.radiusKm ?? EMERGENCY_RADIUS_KM));
  const offered = await offering(db, near.map((f) => f.id), "emergency");
  const ids = offered.map((o) => o.facility_id);
  const [statuses, links, reports] = await Promise.all([
    statusFor(db, ids, "emergency"),
    linksFor(db, ids),
    reportsFor(db, ids, daysBefore(input.now, REPORT_WINDOW_DAYS)),
  ]);

  const byId = new Map(near.map((f) => [f.id, f]));
  const statusBy = new Map(statuses.map((s) => [s.facility_id, s]));
  const linksBy = groupBy(links, (l) => l.facility_id);
  const reportsBy = groupBy(reports, (r) => r.facility_id);
  return ids.flatMap((id) => {
    const facility = byId.get(id);
    if (!facility) return [];
    return [
      { facility, status: statusBy.get(id) ?? null, links: linksBy.get(id) ?? [], reports: reportsBy.get(id) ?? [] },
    ];
  });
}

// Screen 16: hospital morning check (rule M) ---------------------------------------------------------

export type MorningCheck = FacilityDetail & {
  /** Daily counts for the last 7 days, for "people found you". */
  reach: ReachDailyRow[];
};

export async function getMorningCheck(db: Db, facilityId: string, now: Date): Promise<MorningCheck | null> {
  const detail = await getFacilityDetail(db, facilityId, now);
  if (!detail) return null;
  const weekAgo = daysBefore(now, 7).slice(0, 10);
  const reach = rows(
    await db.from("reach_daily").select("*").eq("facility_id", facilityId).gte("day", weekAgo).order("day"),
    "reach",
  );
  return { ...detail, reach };
}

// Screen 18: insurer network health (rule K) -----------------------------------------------------

export type InsurerNetwork = {
  insurer: InsurerRow;
  /** This insurer's row at every facility that has one. */
  links: FacilityInsurerRow[];
  /** Facilities named in links or reports. */
  facilities: FacilityRow[];
  /** Live reports for this insurer, last 30 days. */
  reports: PublicReportRow[];
  /** Search counts for this insurer, last 30 days (rule K). */
  searches: SearchDailyRow[];
};

export async function getInsurerNetwork(db: Db, insurerId: string, now: Date): Promise<InsurerNetwork | null> {
  const insurer = maybe<InsurerRow>(await db.from("insurers").select("*").eq("id", insurerId).maybeSingle(), "insurer");
  if (!insurer) return null;
  const since = daysBefore(now, INSURER_WINDOW_DAYS);

  const [links, reports, searches] = await Promise.all([
    rows(await db.from("facility_insurers").select("*").eq("insurer_id", insurerId), "card links"),
    rows(
      await db.from("public_card_reports").select("*").eq("insurer_id", insurerId).gte("created_at", since),
      "reports",
    ),
    rows(
      await db.from("search_daily").select("*").eq("insurer_id", insurerId).gte("day", since.slice(0, 10)),
      "searches",
    ),
  ]);

  const ids = [...new Set([...links.map((l) => l.facility_id), ...reports.map((r) => r.facility_id)])];
  const facilities = ids.length
    ? rows(await db.from("facilities").select("*").in("id", ids), "facilities")
    : [];
  return { insurer, links, facilities, reports, searches };
}

// Search log (rule K) ---------------------------------------------------------------------------

/** Count one search: the card (null for "No card/cash"), the ~2 km area cell, and whether it found B2 or B3. */
export async function logSearch(
  db: Db,
  input: { insurerId: string | null; areaCell: string; hadConfirmedResult: boolean },
): Promise<void> {
  const { error } = await db.rpc("log_search", {
    p_insurer_id: input.insurerId,
    p_area_cell: input.areaCell,
    p_had_confirmed: input.hadConfirmedResult,
  });
  if (error) throw new Error(`Could not log the search: ${error.message}`);
}
