// Prompt 10b: checks one verification call before it is saved, from the /admin/calls form or a row
// of the CSV import. Pure, so both paths share it and the tests fix the time. No patient data:
// the person who answered is a role only (rule 2).
import { parseLocation } from "@/lib/admin/location";
import type { CallAnswer } from "@/lib/db/types";
import { telHref } from "@/lib/view/phone";

export const CALL_ANSWERS: CallAnswer[] = ["accepts", "does_not", "partial", "not_asked"];

/** In plain words, for the form and the summary. */
export const ANSWER_TEXT: Record<CallAnswer, string> = {
  accepts: "Accepts",
  does_not: "Does not accept",
  partial: "Partial",
  not_asked: "Not asked",
};

/** Suggestions for "who answered": a role, never a name. */
export const ANSWERED_ROLES = ["Front desk", "Records", "NHIS desk", "Accounts", "Nurse", "Doctor", "Administrator"];

/** Calls before this date can't be ours: Veriq started calling in 2026. */
const EARLIEST = Date.parse("2026-01-01T00:00:00Z");
/** A clock a few minutes fast is fine; a call in the future is a typo. */
const FUTURE_SLACK_MS = 5 * 60_000;

export type RawCall = {
  facilityId: string;
  /** "2026-10-28T10:15" or "2026-10-28 10:15", Accra time (GMT, so the same as UTC). */
  calledAt: string;
  callerId: string;
  answeredRole: string;
  phone: string;
  /** One entry per card; a missing card counts as "not asked". */
  answers: { insurerId: string; answer: string; note: string }[];
  services: string[];
  usualHours: string;
  /** "lat, lng" as the "Needs a location" tool reads it, or empty. */
  location: string;
};

export type CallContext = {
  insurerIds: string[];
  serviceIds: string[];
  /** Active admin accounts that can be named as the caller: id to email. */
  callers: Map<string, string>;
  now: Date;
};

/** What record_verification_call() takes (supabase/migrations/20261028000011_verification_calls.sql). */
export type CallPayload = {
  facility_id: string;
  called_at: string;
  called_by: string;
  caller_label: string;
  answered_role: string;
  phone_reached: string;
  answers: { insurer_id: string; answer: CallAnswer; note: string | null }[];
  services: string[];
  usual_hours: string | null;
  lat: number | null;
  lng: number | null;
};

export type FieldError = { field: string; message: string };
export type CheckedCall = { ok: true; payload: CallPayload } | { ok: false; errors: FieldError[] };

/** "2026-10-28T10:15" (Accra time, GMT) as an ISO time, or null if it can't be read. */
export function parseCallTime(text: string): string | null {
  const m = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|\+00:00)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  const back = new Date(ms);
  // Rejects 31 June or 25:00 rather than rolling them over.
  if (back.getUTCMonth() !== Number(mo) - 1 || back.getUTCDate() !== Number(d) || back.getUTCHours() !== Number(h)) return null;
  return back.toISOString();
}

/** The number as dialled, digits only (and a leading +), or null if it can't really be called. */
export function normalizePhone(text: string): string | null {
  const href = telHref(text);
  return href ? href.slice("tel:".length) : null;
}

export function checkCall(raw: RawCall, ctx: CallContext): CheckedCall {
  const errors: FieldError[] = [];
  const add = (field: string, message: string) => errors.push({ field, message });

  if (!/^[0-9a-f-]{36}$/i.test(raw.facilityId)) add("facility", "Choose the facility you called.");

  const calledAt = parseCallTime(raw.calledAt);
  if (!calledAt) add("called_at", "Type the date and time of the call, e.g. 2026-10-28 10:15.");
  else if (Date.parse(calledAt) > ctx.now.getTime() + FUTURE_SLACK_MS) add("called_at", "That time is in the future.");
  else if (Date.parse(calledAt) < EARLIEST) add("called_at", "That date is before Veriq started calling (2026).");

  const callerLabel = ctx.callers.get(raw.callerId);
  if (!callerLabel) add("caller", "Choose who called: an active admin account.");

  const role = raw.answeredRole.trim().replace(/\s+/g, " ");
  if (!role) add("answered_role", "Say who answered, by role only, e.g. front desk.");
  else if (role.length > 60) add("answered_role", "Keep the role short: 60 characters at most.");

  const phone = normalizePhone(raw.phone);
  if (!raw.phone.trim()) add("phone", "Type the number you reached.");
  else if (!phone) add("phone", "That isn't a number we can call, e.g. 030 222 1234 or +233 24 123 4567.");

  const given = new Map(raw.answers.map((a) => [a.insurerId, a]));
  for (const id of given.keys()) if (!ctx.insurerIds.includes(id)) add("answers", "An answer names a card we don't know.");
  const answers = ctx.insurerIds.map((insurerId) => {
    const a = given.get(insurerId);
    const answer = (a?.answer.trim() || "not_asked") as CallAnswer;
    const note = a?.note.trim().replace(/\s+/g, " ") || null;
    if (!CALL_ANSWERS.includes(answer)) add(`answer-${insurerId}`, "Choose accepts, does not accept, partial or not asked.");
    else if (answer === "partial" && !note) add(`answer-${insurerId}`, "Partial needs a short note, e.g. top-up for scans.");
    if (note && note.length > 120) add(`answer-${insurerId}`, "Keep the note short: 120 characters at most.");
    return { insurer_id: insurerId, answer, note };
  });

  const services = [...new Set(raw.services.map((s) => s.trim()).filter(Boolean))];
  for (const s of services) if (!ctx.serviceIds.includes(s)) add("services", `Unknown service: ${s}.`);

  const usualHours = raw.usualHours.trim().replace(/\s+/g, " ") || null;
  if (usualHours && usualHours.length > 80) add("usual_hours", "Keep the hours short: 80 characters at most.");

  let lat: number | null = null;
  let lng: number | null = null;
  if (raw.location.trim()) {
    const loc = parseLocation(raw.location);
    if (loc.ok) ({ lat, lng } = loc);
    else add("location", loc.message);
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      facility_id: raw.facilityId.toLowerCase(),
      called_at: calledAt!,
      called_by: raw.callerId,
      caller_label: callerLabel!,
      answered_role: role,
      phone_reached: phone!,
      answers,
      services,
      usual_hours: usualHours,
      lat,
      lng,
    },
  };
}

/** What the /admin/calls form gets back: a summary line and an error per field (useActionState). */
export type CallFormState = {
  error?: string;
  fields?: Record<string, string>;
  /** What was typed, given back so a failed check keeps it (React resets the form after an action). */
  values?: Record<string, string>;
  services?: string[];
} | null;
