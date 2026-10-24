// Database types, written by hand to match supabase/migrations.
// Once a Supabase project exists, `npx supabase gen types typescript` can replace this file.

export type FacilityType = "public" | "mission" | "private" | "quasi";
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
  type: FacilityType;
  region: string;
  district: string;
  area: string;
  lat: number;
  lng: number;
  phone: string | null;
  verified: boolean;
  verified_at: string | null;
  nhia_listed: boolean;
  is_sample: boolean;
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
  created_at: string;
};

/** Live reports only, without the device hash (rules 2 and A). */
export type PublicReportRow = Omit<CardReportRow, "device_hash" | "state">;

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
      facilities: Table<FacilityRow, "name" | "type" | "region" | "district" | "area" | "lat" | "lng">;
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
