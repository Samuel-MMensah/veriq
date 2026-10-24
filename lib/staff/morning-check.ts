// Screen 16: the hospital morning check. Loads what the form shows, reads the submitted form, and
// publishes what rule M plans. Every write is limited to the signed-in hospital's facility.
import { getMorningCheck, listInsurers, type MorningCheck } from "@/lib/db/queries";
import type { Db } from "@/lib/db/supabase";
import type { HospitalSays, InsurerRow, ReportItem, ServiceStatus } from "@/lib/db/types";
import {
  cardCheckDue,
  optionsFor,
  planCardConfirmations,
  planStatusRows,
  topUpPrompts,
  type CardAnswer,
  type StatusOption,
  type SubmittedStatus,
  type TopUpPrompt,
} from "@/lib/rules/morning";
import { agoText, ageMs } from "@/lib/rules/time";

const ITEM_LABEL: Record<ReportItem, string> = { scan: "scan", drugs: "drugs", lab: "lab test", registration: "registration" };
const SAYS: HospitalSays[] = ["accepts", "partial", "does_not"];
const MAX_AMOUNT_GHS = 100_000;

export type MorningCheckView = {
  facilityName: string;
  services: { serviceId: string; label: string; options: StatusOption[]; status: ServiceStatus | null; fromTime: string | null }[];
  cards: { insurerId: string; name: string; says: HospitalSays | null; due: boolean; confirmedText: string | null }[];
  prompts: (TopUpPrompt & { cardName: string; itemLabel: string })[];
  /** "people found you" over the last 7 days (reach_daily views). */
  reachLastWeek: number;
};

export function buildMorningCheckView({ check, insurers, now }: { check: MorningCheck; insurers: InsurerRow[]; now: Date }): MorningCheckView {
  const nameOf = new Map(insurers.map((i) => [i.id, i.name]));
  const statusBy = new Map(check.statuses.map((s) => [s.service_id, s]));
  return {
    facilityName: check.facility.name,
    services: check.services
      .map((s) => {
        const current = statusBy.get(s.service_id);
        return {
          serviceId: s.service_id,
          label: s.service?.name ?? s.service_id,
          options: optionsFor(s.service_id),
          status: current?.status ?? null,
          fromTime: current?.from_time?.slice(0, 5) ?? null,
        };
      })
      // Emergency first, then services with a status today, then the rest (screen 16).
      .sort(
        (a, b) =>
          Number(b.serviceId === "emergency") - Number(a.serviceId === "emergency") ||
          Number(b.status !== null) - Number(a.status !== null) ||
          a.label.localeCompare(b.label),
      ),
    cards: check.links
      .map((l) => ({
        insurerId: l.insurer_id,
        name: nameOf.get(l.insurer_id) ?? "Card",
        says: l.hospital_says,
        due: cardCheckDue(l, now),
        confirmedText: l.hospital_confirmed_at ? `confirmed ${agoText(ageMs(l.hospital_confirmed_at, now))}` : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    prompts: topUpPrompts({ reports: check.reports, responses: check.responses, now }).map((p) => ({
      ...p,
      cardName: nameOf.get(p.insurerId) ?? "card",
      itemLabel: ITEM_LABEL[p.item],
    })),
    reachLastWeek: check.reach.reduce((sum, d) => sum + d.views, 0),
  };
}

export async function loadMorningCheck(db: Db, facilityId: string, now: Date): Promise<MorningCheckView | null> {
  const [check, insurers] = await Promise.all([getMorningCheck(db, facilityId, now), listInsurers(db)]);
  return check ? buildMorningCheckView({ check, insurers, now }) : null;
}

export type PromptAnswer = { insurerId: string; item: ReportItem; answer: "confirm" | "correct"; amountGhs: number | null };
export type MorningForm = { statuses: SubmittedStatus[]; cards: CardAnswer[]; prompts: PromptAnswer[] };

/**
 * Reads the form: status:{serviceId}, time:{serviceId}, card:{insurerId},
 * prompt:{insurerId}:{item} = confirm|correct, amount:{insurerId}:{item}.
 */
export function parseMorningForm(entries: Iterable<[string, string]>): MorningForm {
  const fields = new Map(entries);
  const form: MorningForm = { statuses: [], cards: [], prompts: [] };
  for (const [name, value] of fields) {
    const [kind, a, b] = name.split(":");
    if (kind === "status" && a && value) {
      form.statuses.push({ serviceId: a, status: value as ServiceStatus, fromTime: fields.get(`time:${a}`) || null });
    } else if (kind === "card" && a && SAYS.includes(value as HospitalSays)) {
      form.cards.push({ insurerId: a, says: value as HospitalSays });
    } else if (kind === "prompt" && a && b && (value === "confirm" || value === "correct")) {
      const raw = (fields.get(`amount:${a}:${b}`) ?? "").replace(/[^\d.]/g, "");
      form.prompts.push({ insurerId: a, item: b as ReportItem, answer: value, amountGhs: raw === "" ? null : Number(raw) });
    }
  }
  return form;
}

export type PublishResult = { services: number; cards: number; answers: number };

const must = (r: { error: { message: string } | null }, what: string) => {
  if (r.error) throw new Error(`Could not save ${what}: ${r.error.message}`);
};

/** rule M: publish the morning check for this facility only. `db` is the server's service access. */
export async function publishMorningCheck({
  db,
  facilityId,
  form,
  now,
}: {
  db: Db;
  facilityId: string;
  form: MorningForm;
  now: Date;
}): Promise<PublishResult> {
  const check = await getMorningCheck(db, facilityId, now);
  if (!check) throw new Error("Unknown hospital.");

  const offered = new Set(check.services.map((s) => s.service_id));
  const notOffered = form.statuses.find((s) => !offered.has(s.serviceId));
  if (notOffered) throw new Error(`${notOffered.serviceId} isn't a service of this hospital.`);

  // rule M: one status row per changed service.
  const rows = planStatusRows({ current: check.statuses, submitted: form.statuses, now });
  for (const r of rows) {
    must(
      await db.from("status_updates").insert({
        facility_id: facilityId,
        service_id: r.serviceId,
        status: r.status,
        from_time: r.fromTime,
        note: r.note,
        source: "hospital",
        created_at: now.toISOString(),
      }),
      "a status",
    );
  }

  // rule M: hospital_confirmed_at for every card they confirm.
  const cards = planCardConfirmations({ links: check.links, answers: form.cards, now });
  for (const c of cards) {
    must(
      await db
        .from("facility_insurers")
        .update({ hospital_says: c.hospital_says, hospital_confirmed_at: c.hospital_confirmed_at })
        .eq("facility_id", facilityId)
        .eq("insurer_id", c.insurerId),
      "a card",
    );
  }

  // Answers to the top-up prompts that are still open (rule T reads them).
  const open = topUpPrompts({ reports: check.reports, responses: check.responses, now });
  let answers = 0;
  for (const p of form.prompts) {
    const prompt = open.find((o) => o.insurerId === p.insurerId && o.item === p.item);
    if (!prompt) continue;
    if (p.answer === "correct" && (p.amountGhs === null || !Number.isFinite(p.amountGhs) || p.amountGhs < 0 || p.amountGhs > MAX_AMOUNT_GHS)) {
      throw new Error("Please give the right top-up amount in cedis (0 if there is none).");
    }
    must(
      await db.from("hospital_responses").insert({
        facility_id: facilityId,
        insurer_id: p.insurerId,
        kind: p.answer === "confirm" ? "confirm_topup" : "correct_topup",
        item: p.item,
        amount_ghs: p.answer === "confirm" ? prompt.amountGhs : p.amountGhs,
        created_at: now.toISOString(),
      }),
      "an answer",
    );
    answers++;
  }

  return { services: rows.length, cards: cards.length, answers };
}
