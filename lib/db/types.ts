// Database types, written by hand to match supabase/migrations.
// Once a Supabase project exists, `npx supabase gen types typescript` can replace this file.

export type FacilityType = "public" | "mission" | "private" | "quasi";
export type FacilitySource = "nhia" | "demo";
export type LocationSource = "osm" | "admin" | "none";
export type ServiceStatus = "open" | "closed" | "accepting" | "full" | "working" | "down" | "from_time";
export type StatusSource = "hospital" | "admin";
export type InsurerKind = "public" | "private";
export type ListedBy = "nhia" | "insurer" | "none";
export type HospitalSays = "accepts" | "does_not" | "partial";
export type ReportOutcome = "covered" | "topup" | "refused";
export type ReportItem = "scan" | "drugs" | "lab" | "registration";
export type ReportState = "live" | "held" | "rejected";
export type HospitalResponseKind = "confirm_topup" | "correct_topup" | "dispute_refusals";
export type StaffRole = "hospital" | "insurer" | "admin";

export type FacilityRow = {
  id: string;
  name: string;
  /** Ownership. null for a real facility whose source file doesn't say (rule D1). */
  type: FacilityType | null;
  region: string;
  district: string;
  /** null when the source file leaves it blank. */
  area: string | null;
  /** null when location_source is "none" (rule D1). */
  lat: number | null;
  lng: number | null;
  phone: string | null;
  verified: boolean;
  verified_at: string | null;
  /** The admin who verified the hospital (Prompt 10). */
  verified_by: string | null;
  nhia_listed: boolean;
  is_sample: boolean;
  /** "demo" for the invented hospitals (rule 1), "nhia" for the NHIA list (rules D1–D3). */
  source: FacilitySource;
  /** The row or code in the source file. */
  source_ref: string | null;
  /** "YYYY-MM-DD": when the source list was taken. */
  source_date: string | null;
  /** The facility type as the source file writes it, e.g. "PRIMARY HOSPITAL". */
  nhia_type: string | null;
  location_source: LocationSource;
  location_checked_at: string | null;
  created_at: string;
};

export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  created_at: string;
};

export type FacilityServiceRow = {
  facility_id: string;
  service_id: string;
  offered: boolean;
  usual_hours: string | null;
  created_at: string;
};

export type StatusUpdateRow = {
  id: string;
  facility_id: string;
  service_id: string;
  status: ServiceStatus;
  /** "HH:MM:SS" when status is "from_time". */
  from_time: string | null;
  /** "HH:MM:SS": the status holds until then (rule F), or null. */
  until_time: string | null;
  note: string | null;
  source: StatusSource;
  created_by: string | null;
  created_at: string;
};

/** Newest status_updates row per facility and service (rule F). */
export type CurrentStatusRow = Omit<StatusUpdateRow, "created_by">;

export type InsurerRow = {
  id: string;
  slug: string;
  name: string;
  kind: InsurerKind;
  created_at: string;
};

export type FacilityInsurerRow = {
  facility_id: string;
  insurer_id: string;
  listed_by: ListedBy;
  hospital_says: HospitalSays | null;
  hospital_confirmed_at: string | null;
  created_at: string;
};

export type CardReportRow = {
  id: string;
  facility_id: string;
  insurer_id: string;
  service_id: string | null;
  outcome: ReportOutcome;
  amount_ghs: number | null;
  item: ReportItem | null;
  device_hash: string;
  state: ReportState;
  /** When an admin released or rejected a held report (rule A). */
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

/** Live reports only, without the device hash (rules 2 and A). */
export type PublicReportRow = Omit<CardReportRow, "device_hash" | "state" | "reviewed_at" | "reviewed_by">;

export type HospitalResponseRow = {
  id: string;
  facility_id: string;
  insurer_id: string;
  kind: HospitalResponseKind;
  item: ReportItem | null;
  amount_ghs: number | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type ProfileRow = {
  user_id: string;
  role: StaffRole;
  facility_id: string | null;
  insurer_id: string | null;
  phone: string | null;
  email: string | null;
  display_name: string | null;
  disabled_at: string | null;
  must_change_password: boolean;
  sessions_valid_after: string;
  created_by: string | null;
  created_at: string;
};

export type AdminActionKind =
  | "create_account"
  | "disable_account"
  | "enable_account"
  | "reset_password"
  | "link_account"
  | "verify_hospital"
  | "unverify_hospital"
  | "release_report"
  | "reject_report"
  | "set_location";

/** Append-only admin log (Prompt 10): who did what, when and why. */
export type AdminActionRow = {
  id: string;
  actor_id: string | null;
  actor_label: string;
  action: AdminActionKind;
  facility_id: string | null;
  profile_id: string | null;
  report_id: string | null;
  reason: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type ReachDailyRow = {
  facility_id: string;
  /** "YYYY-MM-DD" */
  day: string;
  views: number;
  search_hits: number;
  created_at: string;
};

export type SearchDailyRow = {
  id: string;
  insurer_id: string | null;
  day: string;
  area_cell: string;
  had_confirmed_result: boolean;
  searches: number;
  created_at: string;
};

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

type View<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      facilities: Table<FacilityRow, "name" | "region" | "district">;
      services: Table<ServiceRow, "id" | "name" | "category">;
      facility_services: Table<FacilityServiceRow, "facility_id" | "service_id">;
      status_updates: Table<StatusUpdateRow, "facility_id" | "service_id" | "status" | "source">;
      insurers: Table<InsurerRow, "slug" | "name" | "kind">;
      facility_insurers: Table<FacilityInsurerRow, "facility_id" | "insurer_id">;
      card_reports: Table<CardReportRow, "facility_id" | "insurer_id" | "outcome" | "device_hash">;
      hospital_responses: Table<HospitalResponseRow, "facility_id" | "insurer_id" | "kind">;
      profiles: Table<ProfileRow, "user_id" | "role">;
      reach_daily: Table<ReachDailyRow, "facility_id" | "day">;
      search_daily: Table<SearchDailyRow, "day" | "area_cell" | "had_confirmed_result">;
      admin_actions: Table<AdminActionRow, "actor_label" | "action">;
    };
    Views: {
      current_status: View<CurrentStatusRow>;
      public_card_reports: View<PublicReportRow>;
    };
    Functions: {
      staff_role: { Args: Record<string, never>; Returns: StaffRole | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      staff_facility_id: { Args: Record<string, never>; Returns: string | null };
      staff_insurer_id: { Args: Record<string, never>; Returns: string | null };
      staff_verified_facility_id: { Args: Record<string, never>; Returns: string | null };
      reset_demo: { Args: Record<string, never>; Returns: undefined };
      demo_facility_id: { Args: { code: string }; Returns: string };
      log_search: {
        Args: { p_insurer_id: string | null; p_area_cell: string; p_had_confirmed: boolean };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
