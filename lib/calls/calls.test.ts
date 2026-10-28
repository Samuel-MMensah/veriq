// @vitest-environment node
// Prompt 10b: verification calls. The checks, the summary (the pitch number), the CSV import, and
// recording against the real migrations in PGlite (rule B-V facts, real facilities only).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pgliteAuth } from "@/lib/auth/backend";
import { createFirstAdmin } from "@/lib/auth/create-admin";
import { DEMO_ADMIN, staffFromProfile, type Staff } from "@/lib/auth/staff";
import { fakeDb } from "@/lib/db/fake-postgrest";
import { createDb } from "@/lib/db/pglite";
import type { Db } from "@/lib/db/supabase";
import type { FacilityInsurerRow, FacilityRow, InsurerRow, ProfileRow } from "@/lib/db/types";
import { badge } from "@/lib/rules/badge";
import { callCards } from "./context";
import { callCsvHeader, previewCallCsv, type ImportContext } from "./csv";
import { checkCall, normalizePhone, parseCallTime, type CallContext, type RawCall } from "./input";
import { callerAccounts, listCalls, loadCallSummary, recordCall } from "./record";
import { onOfficialList, summarizeCalls, summaryCsv } from "./summary";

const NHIS = "a0000000-0000-4000-8000-000000000001";
const COSMO = "a0000000-0000-4000-8000-000000000002";
const PRU = "a0000000-0000-4000-8000-000000000003";
const AKOMA = "f0000000-0000-4000-8000-000000000001";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const FAC = "22222222-2222-4222-8222-222222222222";
const now = new Date("2026-10-28T12:00:00Z");

const ctx: CallContext = {
  insurerIds: [NHIS, COSMO],
  serviceIds: ["antenatal", "lab"],
  callers: new Map([[ADMIN_ID, "ama@veriq.org"]]),
  now,
};

const raw = (over: Partial<RawCall> = {}): RawCall => ({
  facilityId: FAC,
  calledAt: "2026-10-28 10:15",
  callerId: ADMIN_ID,
  answeredRole: "Front desk",
  phone: "030 222 1234",
  answers: [
    { insurerId: NHIS, answer: "accepts", note: "" },
    { insurerId: COSMO, answer: "partial", note: "top-up for scans" },
  ],
  services: ["antenatal"],
  usualHours: "Mon–Sat 8 am to 5 pm",
  location: "",
  ...over,
});

describe("checking a call (Prompt 10b, item 1)", () => {
  it("reads a good call into what the database takes", () => {
    const r = checkCall(raw(), ctx);
    expect(r).toEqual({
      ok: true,
      payload: {
        facility_id: FAC,
        called_at: "2026-10-28T10:15:00.000Z",
        called_by: ADMIN_ID,
        caller_label: "ama@veriq.org",
        answered_role: "Front desk",
        phone_reached: "0302221234",
        answers: [
          { insurer_id: NHIS, answer: "accepts", note: null },
          { insurer_id: COSMO, answer: "partial", note: "top-up for scans" },
        ],
        services: ["antenatal"],
        usual_hours: "Mon–Sat 8 am to 5 pm",
        lat: null,
        lng: null,
      },
    });
  });

  it("a card left out counts as 'not asked'", () => {
    const r = checkCall(raw({ answers: [] }), ctx);
    expect(r.ok && r.payload.answers.map((a) => a.answer)).toEqual(["not_asked", "not_asked"]);
  });

  it("partial needs its short note", () => {
    const r = checkCall(raw({ answers: [{ insurerId: COSMO, answer: "partial", note: " " }] }), ctx);
    expect(r).toMatchObject({ ok: false, errors: [{ field: `answer-${COSMO}`, message: expect.stringMatching(/short note/) }] });
  });

  it("refuses a placeholder or unreadable phone, a future time, a time before 2026, and an unknown caller", () => {
    const fields = (r: ReturnType<typeof checkCall>) => (r.ok ? [] : r.errors.map((e) => e.field));
    expect(fields(checkCall(raw({ phone: "+233 000 000 001" }), ctx))).toEqual(["phone"]);
    expect(fields(checkCall(raw({ phone: "ask reception" }), ctx))).toEqual(["phone"]);
    expect(fields(checkCall(raw({ calledAt: "2026-10-28 12:06" }), ctx))).toEqual(["called_at"]);
    expect(fields(checkCall(raw({ calledAt: "2026-10-28 12:04" }), ctx))).toEqual([]);
    expect(fields(checkCall(raw({ calledAt: "2025-12-31 23:59" }), ctx))).toEqual(["called_at"]);
    expect(fields(checkCall(raw({ callerId: "someone" }), ctx))).toEqual(["caller"]);
  });

  it("refuses an unknown service, a long role, and a point outside Greater Accra; reads a good point", () => {
    const fields = (r: ReturnType<typeof checkCall>) => (r.ok ? [] : r.errors.map((e) => e.field));
    expect(fields(checkCall(raw({ services: ["surgery"] }), ctx))).toEqual(["services"]);
    expect(fields(checkCall(raw({ answeredRole: "x".repeat(61) }), ctx))).toEqual(["answered_role"]);
    expect(fields(checkCall(raw({ location: "-0.26, 5.56" }), ctx))).toEqual(["location"]);
    const r = checkCall(raw({ location: "5.5612, -0.2601" }), ctx);
    expect(r.ok && [r.payload.lat, r.payload.lng]).toEqual([5.5612, -0.2601]);
  });

  it("reads times as Accra time (GMT) and rejects impossible dates", () => {
    expect(parseCallTime("2026-10-28T09:05")).toBe("2026-10-28T09:05:00.000Z");
    expect(parseCallTime("2026-06-31 10:00")).toBeNull();
    expect(parseCallTime("28/10/2026 10:00")).toBeNull();
    expect(normalizePhone("+233 24 123 4567")).toBe("+233241234567");
  });
});

describe("the call summary (Prompt 10b, item 4): the pitch number", () => {
  const insurers = [
    { id: COSMO, name: "Cosmopolitan Health", slug: "cosmopolitan", kind: "private" as const },
    { id: NHIS, name: "NHIS", slug: "nhis", kind: "public" as const },
  ];
  const calls = [
    { id: "c1", facility_id: "f1", called_at: "2026-10-20T10:00:00.000Z" },
    { id: "c2", facility_id: "f1", called_at: "2026-10-25T10:00:00.000Z" }, // f1 called twice: the newest counts
    { id: "c3", facility_id: "f2", called_at: "2026-10-21T10:00:00.000Z" },
    { id: "c4", facility_id: "f3", called_at: "2026-10-22T10:00:00.000Z" },
    { id: "c5", facility_id: "f4", called_at: "2026-10-23T10:00:00.000Z" },
  ];
  const answers = [
    { call_id: "c1", insurer_id: NHIS, answer: "does_not" as const },
    { call_id: "c2", insurer_id: NHIS, answer: "accepts" as const },
    { call_id: "c3", insurer_id: NHIS, answer: "does_not" as const },
    { call_id: "c4", insurer_id: NHIS, answer: "partial" as const },
    { call_id: "c5", insurer_id: NHIS, answer: "not_asked" as const },
    { call_id: "c3", insurer_id: COSMO, answer: "accepts" as const },
    { call_id: "c4", insurer_id: COSMO, answer: "does_not" as const },
  ];
  const links = [
    { facility_id: "f1", insurer_id: NHIS, listed_by: "nhia" as const },
    { facility_id: "f2", insurer_id: NHIS, listed_by: "nhia" as const },
    { facility_id: "f3", insurer_id: NHIS, listed_by: "none" as const },
    { facility_id: "f3", insurer_id: COSMO, listed_by: "insurer" as const },
    { facility_id: "f2", insurer_id: COSMO, listed_by: "nhia" as const }, // an NHIA row never lists a private card
  ];
  const s = summarizeCalls({ calls, answers, links, insurers });

  it("counts each facility once per card, with its newest answer; 'not asked' doesn't count", () => {
    expect(s.cards[0]).toEqual({
      insurerId: NHIS,
      card: "NHIS",
      slug: "nhis",
      called: 3,
      accepts: 1,
      partial: 1,
      doesNot: 1,
      matched: 1, // f1: listed and accepts (newest call)
      listedButRefuses: 1, // f2
      notListedButAccepts: 1, // f3 (partial counts as accepts)
    });
  });

  it("a private card's official list is its own list only", () => {
    expect(s.cards[1]).toMatchObject({ card: "Cosmopolitan Health", called: 2, matched: 0, listedButRefuses: 1, notListedButAccepts: 1 });
    expect(onOfficialList("nhia", "private")).toBe(false);
    expect(onOfficialList("nhia", "public")).toBe(true);
    expect(onOfficialList("insurer", "private")).toBe(true);
  });

  it("matched plus both kinds of mismatch is every facility called", () => {
    for (const c of s.cards) expect(c.matched + c.listedButRefuses + c.notListedButAccepts).toBe(c.called);
  });

  it("gives the date range and the totals, and exports the same numbers as CSV", () => {
    expect(s).toMatchObject({ calls: 5, facilities: 4, from: "2026-10-20T10:00:00.000Z", to: "2026-10-25T10:00:00.000Z" });
    expect(summaryCsv(s).split("\r\n")).toEqual([
      "card,facilities_called,matched_official_list,listed_but_refuses,not_listed_but_accepts,accepts,partial,does_not_accept,first_call,last_call",
      "NHIS,3,1,1,1,1,1,1,2026-10-20T10:00:00.000Z,2026-10-25T10:00:00.000Z",
      "Cosmopolitan Health,2,0,1,1,1,0,1,2026-10-20T10:00:00.000Z,2026-10-25T10:00:00.000Z",
      "",
    ]);
  });

  it("no calls: zeros and no date range", () => {
    expect(summarizeCalls({ calls: [], answers: [], links: [], insurers })).toMatchObject({ calls: 0, from: null, to: null });
  });
});

describe("the CSV import (Prompt 10b, item 5): a dry-run preview first", () => {
  const cards = [
    { id: NHIS, slug: "nhis" },
    { id: COSMO, slug: "cosmopolitan" },
  ];
  const ictx: ImportContext = {
    ...ctx,
    cards,
    facilitiesByRef: new Map([["GA-0001", { id: FAC, name: "DANSOMAN POLYCLINIC", source_ref: "GA-0001" }]]),
    callerIdsByEmail: new Map([["ama@veriq.org", ADMIN_ID]]),
    existing: new Set(),
  };
  const header = callCsvHeader(["nhis", "cosmopolitan"]).join(",");
  const good = '2026-10-28 10:15,GA-0001,Dansoman Polyclinic,Ama@veriq.org,Front desk,030 222 1234,accepts,,partial,top-up for scans,antenatal;lab,8 am to 5 pm,"5.5612, -0.2601"';

  it("the template header: lead columns, two per card, then services, hours and location", () => {
    expect(header).toBe(
      "called_at,facility_ref,facility_name,caller_email,answered_role,phone_reached,nhis,nhis_note,cosmopolitan,cosmopolitan_note,services,usual_hours,location",
    );
  });

  it("previews a good row as ready, with the payload the form would save", () => {
    const p = previewCallCsv(`${header}\n${good}\n`, ictx);
    expect(p).toMatchObject({ fileErrors: [], ready: 1, canSave: true });
    expect(p.rows[0]).toMatchObject({ line: 2, status: "ok", payload: { facility_id: FAC, services: ["antenatal", "lab"], lat: 5.5612 } });
  });

  it("names each problem with its column, and blocks saving while any row has one", () => {
    const bad = "2026-10-28 10:15,GA-9999,,nobody@x.org,,12,maybe,,partial,,,,";
    const p = previewCallCsv(`${header}\n${good}\n${bad}\n`, ictx);
    expect(p.canSave).toBe(false);
    expect(p.rows[1]!.errors).toEqual([
      "facility_ref: no real facility has ref GA-9999.",
      "caller_email: nobody@x.org isn't an active admin account.",
      "answered_role: Say who answered, by role only, e.g. front desk.",
      expect.stringMatching(/^phone_reached: That isn't a number we can call/),
      "nhis: Choose accepts, does not accept, partial or not asked.",
      "cosmopolitan: Partial needs a short note, e.g. top-up for scans.",
    ]);
  });

  it("catches a facility name that doesn't match its code", () => {
    const p = previewCallCsv(`${header}\n${good.replace("Dansoman Polyclinic", "Kaneshie Polyclinic")}\n`, ictx);
    expect(p.rows[0]!.errors[0]).toMatch(/isn't the name for GA-0001/);
  });

  it("skips a call already saved, or repeated in the file, as a duplicate (never counted twice)", () => {
    const p = previewCallCsv(`${header}\n${good}\n${good}\n`, { ...ictx, existing: new Set() });
    expect(p.rows.map((r) => r.status)).toEqual(["ok", "duplicate"]);
    const again = previewCallCsv(`${header}\n${good}\n`, { ...ictx, existing: new Set([`${FAC}|2026-10-28T10:15:00.000Z`]) });
    expect(again).toMatchObject({ ready: 0, canSave: false, rows: [{ status: "duplicate" }] });
  });

  it("refuses a file with missing or unknown columns before reading any row", () => {
    const p = previewCallCsv("called_at,facility_ref,whatever\n2026-10-28 10:15,GA-0001,x\n", ictx);
    expect(p.rows).toEqual([]);
    expect(p.fileErrors[0]).toMatch(/^Missing columns: facility_name, caller_email/);
    expect(p.fileErrors[1]).toBe("Unknown columns: whatever.");
  });
});

describe("recording a call (Prompt 10b): real facilities, rule B-V facts", () => {
  let pg: PGlite;
  let db: Db;
  let admin: Staff;
  let facility: FacilityRow;
  let callers: Map<string, string>;
  let insurers: InsurerRow[];

  beforeAll(async () => {
    pg = await createDb();
    db = fakeDb(pg, "owner");
    const auth = pgliteAuth(pg);
    const first = await createFirstAdmin({ auth, db, emailText: "ama@veriq.org", password: "first-admin-pass" });
    if (!first.ok) throw new Error(first.message);
    const userId = (await auth.checkPassword("ama@veriq.org", "first-admin-pass"))!;
    const profile = (await pg.query<ProfileRow>("select * from public.profiles where user_id = $1", [userId])).rows[0]!;
    admin = { ...staffFromProfile(profile, Date.now())!, mustChangePassword: false };
    facility = (await pg.query<FacilityRow>("select * from public.facilities where source = 'nhia' and location_source = 'none' order by name limit 1")).rows[0]!;
    callers = await callerAccounts(db);
    insurers = (await pg.query<InsurerRow>("select * from public.insurers order by name")).rows;
  }, 60_000);

  afterAll(async () => {
    await pg?.close();
  });

  const payloadFor = (over: Partial<RawCall> = {}) => {
    const r = checkCall(
      raw({
        facilityId: facility.id,
        callerId: admin.userId!,
        answers: [
          { insurerId: NHIS, answer: "does_not", note: "" },
          { insurerId: COSMO, answer: "partial", note: "top-up for scans" },
          { insurerId: PRU, answer: "not_asked", note: "" },
        ],
        location: "5.5612, -0.2601",
        // An hour ago by the real clock: the database and the badge use the real time here.
        calledAt: new Date(Date.now() - 3_600_000).toISOString().slice(0, 16),
        ...over,
      }),
      { insurerIds: callCards(insurers).map((i) => i.id), serviceIds: ["antenatal", "lab"], callers, now: new Date() },
    );
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    return r.payload;
  };
  const link = async (insurerId: string) =>
    (await pg.query<FacilityInsurerRow>("select * from public.facility_insurers where facility_id = $1 and insurer_id = $2", [facility.id, insurerId])).rows[0];

  it("saves the call, its answers, the phone, services, hours and location, and logs it", async () => {
    const r = await recordCall({ db, actor: admin, payload: payloadFor() });
    expect(r.ok).toBe(true);
    const f = (await pg.query<FacilityRow>("select * from public.facilities where id = $1", [facility.id])).rows[0]!;
    expect(f).toMatchObject({ phone: "0302221234", phone_source: "veriq_call", location_source: "admin", lat: 5.5612, lng: -0.2601 });
    const services = (await pg.query("select service_id, usual_hours, source from public.facility_services where facility_id = $1", [facility.id])).rows;
    expect(services).toEqual([{ service_id: "antenatal", usual_hours: "Mon–Sat 8 am to 5 pm", source: "veriq_call" }]);
    // NHIS keeps its NHIA listing; Cosmopolitan gets a row with no listing; "not asked" leaves Prudential alone.
    expect(await link(NHIS)).toMatchObject({ listed_by: "nhia", hospital_says: null, call_says: "does_not" });
    expect(await link(COSMO)).toMatchObject({ listed_by: "none", call_says: "partial", call_note: "top-up for scans" });
    expect(await link(PRU)).toBeUndefined();
    const log = (await pg.query("select action, actor_label from public.admin_actions where facility_id = $1", [facility.id])).rows;
    expect(log).toEqual([{ action: "record_call", actor_label: "ama@veriq.org" }]);
  });

  it("rule B-V on the saved facts: NHIS 'does not accept' (BVx), Cosmopolitan 'Veriq call · … with top-ups' (BV)", async () => {
    expect(badge({ link: (await link(NHIS))!, reports: [], now: new Date() }).id).toBe("BVx");
    expect(badge({ link: (await link(COSMO))!, reports: [], now: new Date() })).toMatchObject({ id: "BV", text: expect.stringMatching(/^Veriq call · .* · with top-ups$/) });
  });

  it("the same facility and time can't be saved twice", async () => {
    expect(await recordCall({ db, actor: admin, payload: payloadFor() })).toEqual({ ok: false, message: "This call is already recorded: same facility and time." });
  });

  it("an older paper call adds to the history but never overwrites a newer fact", async () => {
    const r = await recordCall({
      db,
      actor: admin,
      enteredVia: "csv",
      payload: payloadFor({ calledAt: "2026-10-01 09:00", phone: "024 123 4567", answers: [{ insurerId: NHIS, answer: "accepts", note: "" }] }),
    });
    expect(r.ok).toBe(true);
    expect(await link(NHIS)).toMatchObject({ call_says: "does_not" });
    expect((await pg.query<FacilityRow>("select phone from public.facilities where id = $1", [facility.id])).rows[0]!.phone).toBe("0302221234");
    expect((await listCalls(db)).map((c) => c.entered_via)).toEqual(["form", "csv"]);
  });

  it("the summary counts the facility once per card, with the newest answer", async () => {
    const s = await loadCallSummary(db, insurers);
    expect(s).toMatchObject({ calls: 2, facilities: 1 });
    expect(s.cards.find((c) => c.slug === "nhis")).toMatchObject({ called: 1, doesNot: 1, listedButRefuses: 1, matched: 0 });
    expect(s.cards.find((c) => c.slug === "cosmopolitan")).toMatchObject({ called: 1, partial: 1, notListedButAccepts: 1 });
    expect(s.cards.find((c) => c.slug === "prudential")).toMatchObject({ called: 0 });
  });

  it("refuses a demo facility, and the demo admin can't save", async () => {
    expect(await recordCall({ db, actor: admin, payload: { ...payloadFor(), facility_id: AKOMA } })).toEqual({ ok: false, message: "Calls are for real facilities only." });
    expect(await recordCall({ db, actor: DEMO_ADMIN, payload: payloadFor({ calledAt: "2026-10-02 09:00" }) })).toEqual({
      ok: false,
      message: "Only a signed-in Veriq admin can record a call.",
    });
  });

  it("docs/calls: the blank template matches the import, and all 30 suggested facilities are real", async () => {
    const template = readFileSync(join(process.cwd(), "docs/calls/calls-template.csv"), "utf8").trim();
    expect(template).toBe(callCsvHeader(callCards(insurers).map((i) => i.slug)).join(","));
    const readme = readFileSync(join(process.cwd(), "docs/calls/README.md"), "utf8");
    const refs = [...readme.matchAll(/\| `(greater-accra-[^`]+)` \|$/gm)].map((m) => m[1]!);
    expect(new Set(refs).size).toBe(30);
    const found = (await pg.query<{ source_ref: string; nhia_type: string }>("select source_ref, nhia_type from public.facilities where source = 'nhia' and source_ref = any($1)", [refs])).rows;
    expect(found).toHaveLength(30);
    expect(found.filter((f) => /pharmacy|chemical/i.test(f.nhia_type))).toEqual([]);
  });

  it("rule D2: the call form, the CSV and the summary never list an invented demo card", async () => {
    expect(insurers.filter((i) => i.is_sample).map((i) => i.slug).sort()).toEqual(["adom-care", "sika-health"]);
    expect(callCards(insurers).map((i) => i.slug)).toEqual(["nhis", "cosmopolitan", "prudential"]);
    const s = await loadCallSummary(db, insurers);
    expect(s.cards.map((c) => c.slug)).toEqual(["nhis", "cosmopolitan", "prudential"]);
  });

  it("the database keeps calls append-only and real-only", async () => {
    await expect(pg.query("delete from public.verification_calls")).rejects.toThrow(/append-only/);
    await expect(pg.query("update public.verification_call_answers set answer = 'accepts'")).rejects.toThrow(/append-only/);
    await expect(
      pg.query("insert into public.verification_calls (facility_id, called_at, caller_label, answered_role, phone_reached) values ($1, now(), 'x', 'y', '0302221234')", [AKOMA]),
    ).rejects.toThrow(/real facilities only/);
  });
});
