// Prompt 10b, item 5: calls recorded on paper, typed into a CSV and imported. Each row is read and
// checked exactly like the /admin/calls form (checkCall); nothing is saved until the dry-run
// preview is clean and an admin confirms. The blank template is docs/calls/calls-template.csv.
import { parseCsv } from "@/lib/import/csv";
import { checkCall, type CallContext, type CallPayload } from "./input";

/** The columns before and after the card columns. Each card has "{slug}" and "{slug}_note". */
const LEAD = ["called_at", "facility_ref", "facility_name", "caller_email", "answered_role", "phone_reached"] as const;
const TAIL = ["services", "usual_hours", "location"] as const;

export function callCsvHeader(cardSlugs: string[]): string[] {
  return [...LEAD, ...cardSlugs.flatMap((s) => [s, `${s}_note`]), ...TAIL];
}

export type ImportFacility = { id: string; name: string; source_ref: string | null };

export type ImportRow = {
  /** The line in the file (the header is line 1). */
  line: number;
  facilityName: string;
  calledAt: string;
  status: "ok" | "duplicate" | "error";
  errors: string[];
  payload?: CallPayload;
};

export type ImportPreview = {
  /** Problems with the file as a whole (wrong columns); no row is read then. */
  fileErrors: string[];
  rows: ImportRow[];
  /** Rows that would be saved. Nothing is saved while any row has an error. */
  ready: number;
  canSave: boolean;
};

export type ImportContext = CallContext & {
  cards: { id: string; slug: string }[];
  /** Real facilities by their source row (source_ref, e.g. "greater-accra-2026-10-26.csv#row-17"). */
  facilitiesByRef: Map<string, ImportFacility>;
  /** Active admin accounts by email (lower case): user id. */
  callerIdsByEmail: Map<string, string>;
  /** Calls already saved, as "facilityId|ISO time" (one call per facility per moment). */
  existing: Set<string>;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const FIELD_NAMES: Record<string, string> = {
  facility: "facility_ref",
  called_at: "called_at",
  caller: "caller_email",
  answered_role: "answered_role",
  phone: "phone_reached",
  services: "services",
  usual_hours: "usual_hours",
  location: "location",
  answers: "card columns",
};

export function previewCallCsv(text: string, ctx: ImportContext): ImportPreview {
  const table = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  const expected = callCsvHeader(ctx.cards.map((c) => c.slug));
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const missing = expected.filter((h) => !header.includes(h));
  const unknown = header.filter((h) => h && !expected.includes(h));
  const fileErrors: string[] = [];
  if (!table.length) fileErrors.push("The file is empty.");
  else {
    if (missing.length) fileErrors.push(`Missing columns: ${missing.join(", ")}. Start from docs/calls/calls-template.csv.`);
    if (unknown.length) fileErrors.push(`Unknown columns: ${unknown.join(", ")}.`);
  }
  if (fileErrors.length) return { fileErrors, rows: [], ready: 0, canSave: false };

  const col = (row: string[], name: string) => (row[header.indexOf(name)] ?? "").trim();
  const seen = new Set<string>();
  const rows = table.slice(1).map((cells, i): ImportRow => {
    const line = i + 2;
    const ref = col(cells, "facility_ref");
    const name = col(cells, "facility_name");
    const facility = ctx.facilitiesByRef.get(ref);
    const errors: string[] = [];
    if (!ref) errors.push("facility_ref: empty.");
    else if (!facility) errors.push(`facility_ref: no real facility has ref ${ref}.`);
    else if (name && norm(name) !== norm(facility.name)) errors.push(`facility_name: "${name}" isn't the name for ${ref} ("${facility.name}").`);

    const email = col(cells, "caller_email").toLowerCase();
    const checked = checkCall(
      {
        facilityId: facility?.id ?? "00000000-0000-4000-8000-000000000000",
        calledAt: col(cells, "called_at"),
        callerId: ctx.callerIdsByEmail.get(email) ?? "",
        answeredRole: col(cells, "answered_role"),
        phone: col(cells, "phone_reached"),
        answers: ctx.cards.map((c) => ({ insurerId: c.id, answer: col(cells, c.slug).toLowerCase(), note: col(cells, `${c.slug}_note`) })),
        services: col(cells, "services").split(/[;|]/),
        usualHours: col(cells, "usual_hours"),
        location: col(cells, "location"),
      },
      ctx,
    );
    if (!checked.ok) {
      for (const e of checked.errors) {
        const field = e.field.startsWith("answer-")
          ? (ctx.cards.find((c) => `answer-${c.id}` === e.field)?.slug ?? "card")
          : (FIELD_NAMES[e.field] ?? e.field);
        if (field === "caller_email" && email) errors.push(`caller_email: ${email} isn't an active admin account.`);
        else errors.push(`${field}: ${e.message}`);
      }
    }
    const base = { line, facilityName: facility?.name ?? name, calledAt: col(cells, "called_at") };
    if (errors.length || !checked.ok) return { ...base, status: "error", errors };

    const key = `${checked.payload.facility_id}|${checked.payload.called_at}`;
    if (ctx.existing.has(key) || seen.has(key)) {
      return { ...base, status: "duplicate", errors: ["Already recorded: same facility and time. It will be skipped."] };
    }
    seen.add(key);
    return { ...base, status: "ok", errors: [], payload: checked.payload };
  });

  const ready = rows.filter((r) => r.status === "ok").length;
  return { fileErrors, rows, ready, canSave: ready > 0 && rows.every((r) => r.status !== "error") };
}
