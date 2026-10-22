// Rule K: insurer figures for the last 30 days. Callers pass one insurer's rows.
import type { HospitalSays, ListedBy, ReportOutcome, ReportState } from "@/lib/db/types";
import { cellCentre, haversineKm } from "@/lib/geo";
import { badge } from "./badge";
import { DAY_MS, withinDays } from "./time";

export type KpiFacility = { id: string; name: string; area: string; lat: number; lng: number };
export type KpiLink = {
  facility_id: string;
  listed_by: ListedBy;
  hospital_says: HospitalSays | null;
  hospital_confirmed_at: string | null;
};
export type KpiReport = { facility_id: string; outcome: ReportOutcome; created_at: string; state?: ReportState };
export type KpiSearch = { day: string; area_cell: string; had_confirmed_result: boolean; searches: number };

export type TurnedAwayRow = {
  facilityId: string;
  name: string;
  /** On this insurer's list (for NHIS, the NHIA list). */
  listed: boolean;
  refusals: number;
  accepted: number;
  lastReportAt: string | null;
};

export type CoverageGap = { areaCell: string; searches: number; nearestArea: string | null };

export type InsurerFigures = {
  onList: number;
  confirmed: number;
  confirmedShareOfList: number;
  refused: { count: number; facilities: number };
  searches: { total: number; confirmedShare: number };
  turnedAway: TurnedAwayRow[];
  gaps: CoverageGap[];
};

const WINDOW_DAYS = 30;
/** A gap is named after the nearest hospital's area if one is this close to the cell centre. */
const NAME_GAP_WITHIN_KM = 10;

export function insurerFigures({
  facilities,
  links,
  reports,
  searches,
  now,
}: {
  facilities: KpiFacility[];
  links: KpiLink[];
  reports: KpiReport[];
  searches: KpiSearch[];
  now: Date;
}): InsurerFigures {
  // Rule A: held and rejected never count.
  const recent = reports.filter((r) => (r.state ?? "live") === "live" && withinDays(r.created_at, now, WINDOW_DAYS));
  const reportsBy = new Map<string, KpiReport[]>();
  for (const r of recent) reportsBy.set(r.facility_id, [...(reportsBy.get(r.facility_id) ?? []), r]);

  // rule K: hospitals on the list. For NHIS the list is NHIA's, so both list kinds count.
  const isListed = (l: KpiLink) => l.listed_by !== "none";
  const listed = links.filter(isListed);

  // rule K: confirmed = hospitals at badge B2 (rule B).
  const atB2 = links.filter((l) => badge({ link: l, reports: reportsBy.get(l.facility_id) ?? [], now }).id === "B2");
  const listedAtB2 = atB2.filter(isListed).length;

  // rule K: members refused, and at how many hospitals.
  const refusals = recent.filter((r) => r.outcome === "refused");

  // rule K: member searches with this card, and the share that found a B2 or B3 hospital.
  const windowStartDay = new Date(now.getTime() - WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);
  const recentSearches = searches.filter((s) => s.day >= windowStartDay);
  const total = recentSearches.reduce((sum, s) => sum + s.searches, 0);
  const found = recentSearches.filter((s) => s.had_confirmed_result).reduce((sum, s) => sum + s.searches, 0);

  // "Where members were turned away": hospitals with refusals, plus unlisted hospitals that served members.
  const names = new Map(facilities.map((f) => [f.id, f.name]));
  const linkBy = new Map(links.map((l) => [l.facility_id, l]));
  const turnedAway = [...reportsBy.entries()]
    .map(([facilityId, rs]): TurnedAwayRow => {
      const link = linkBy.get(facilityId);
      return {
        facilityId,
        name: names.get(facilityId) ?? "Unknown hospital",
        listed: link ? isListed(link) : false,
        refusals: rs.filter((r) => r.outcome === "refused").length,
        accepted: rs.filter((r) => r.outcome !== "refused").length,
        lastReportAt: rs.reduce<string | null>((latest, r) => (!latest || r.created_at > latest ? r.created_at : latest), null),
      };
    })
    .filter((row) => row.refusals > 0 || (!row.listed && row.accepted > 0))
    .sort((a, b) => b.refusals - a.refusals || b.accepted - a.accepted || a.name.localeCompare(b.name));

  // rule K: coverage gaps = area cells where searches found no B2 or B3 hospital within 5 km.
  // The search log records that per search (had_confirmed_result), so gaps are summed from it.
  const gapCounts = new Map<string, number>();
  for (const s of recentSearches) {
    if (!s.had_confirmed_result) gapCounts.set(s.area_cell, (gapCounts.get(s.area_cell) ?? 0) + s.searches);
  }
  const gaps = [...gapCounts.entries()]
    .map(([areaCell, count]) => ({ areaCell, searches: count, nearestArea: nearestArea(areaCell, facilities) }))
    .sort((a, b) => b.searches - a.searches || a.areaCell.localeCompare(b.areaCell));

  return {
    onList: listed.length,
    confirmed: atB2.length,
    confirmedShareOfList: listed.length ? listedAtB2 / listed.length : 0,
    refused: { count: refusals.length, facilities: new Set(refusals.map((r) => r.facility_id)).size },
    searches: { total, confirmedShare: total ? found / total : 0 },
    turnedAway,
    gaps,
  };
}

function nearestArea(cell: string, facilities: KpiFacility[]): string | null {
  const centre = cellCentre(cell);
  let best: { area: string; km: number } | null = null;
  for (const f of facilities) {
    const km = haversineKm(centre, f);
    if (km <= NAME_GAP_WITHIN_KM && (!best || km < best.km)) best = { area: f.area, km };
  }
  return best?.area ?? null;
}
