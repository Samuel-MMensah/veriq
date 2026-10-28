// @vitest-environment node
// Prompt 10: staff accounts, hospital verification, held-report review and the admin log, against
// the real migrations in PGlite with the local sign-in backend.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pgliteAuth, type AuthBackend } from "@/lib/auth/backend";
import { DEMO_ADMIN, canPublish, staffFromProfile, type Staff } from "@/lib/auth/staff";
import { fakeDb } from "@/lib/db/fake-postgrest";
import { createDb } from "@/lib/db/pglite";
import type { Db } from "@/lib/db/supabase";
import type { AdminActionRow, ProfileRow } from "@/lib/db/types";
import { createFirstAdmin } from "@/lib/auth/create-admin";
import { historyFor } from "./log";
import { listHeldReports, reviewHeldReport } from "./reports";
import { saveLocation } from "./save-location";
import { createStaffAccount, linkAccount, listStaff, resetStaffPassword, setAccountDisabled } from "./staff";
import { listHospitalClaims, unverifyHospital, verifyHospital } from "./verify";
import { matchesSearch, tileFor } from "./location";

const AKOMA = "f0000000-0000-4000-8000-000000000001";
const NHIS = "a0000000-0000-4000-8000-000000000001";
// Each action a second after the last, so "newest first" is well defined.
let clock = Date.now();
const tick = () => new Date((clock += 1000));

let pg: PGlite;
let db: Db;
let auth: AuthBackend;
let admin: Staff;
let real: { id: string; name: string }[];

async function profile(userId: string): Promise<ProfileRow> {
  return (await pg.query<ProfileRow>("select * from public.profiles where user_id = $1", [userId])).rows[0]!;
}

beforeAll(async () => {
  pg = await createDb();
  db = fakeDb(pg, "owner");
  auth = pgliteAuth(pg);
  const first = await createFirstAdmin({ auth, db, emailText: "Boss@Veriq.org", password: "first-admin-pass" });
  if (!first.ok) throw new Error(first.message);
  const userId = (await auth.checkPassword("boss@veriq.org", "first-admin-pass"))!;
  admin = { ...staffFromProfile(await profile(userId), Date.now())!, mustChangePassword: false };
  real = (await pg.query<{ id: string; name: string }>("select id, name from public.facilities where source = 'nhia' order by name limit 3")).rows;
}, 60_000);

afterAll(async () => {
  await pg?.close();
});

describe("the first admin (npm run create-admin)", () => {
  it("is an admin who must set their own password, logged as made by the script", async () => {
    expect(admin.role).toBe("admin");
    const p = await profile(admin.userId!);
    expect(p.must_change_password).toBe(true);
    const log = await historyFor(db, { profile_id: admin.userId! });
    expect(log[0]).toMatchObject({ action: "create_account", actor_label: "create-admin script" });
  });

  it("refuses a second account for the same email", async () => {
    const again = await createFirstAdmin({ auth, db, emailText: "boss@veriq.org" });
    expect(again).toEqual({ ok: false, message: "That email already has an account." });
  });
});

describe("staff accounts (/admin/staff)", () => {
  let hospitalUser: string;
  let oneTime: string;

  it("an admin makes a hospital account linked to a real facility, with a one-time password", async () => {
    const r = await createStaffAccount({ db, auth, actor: admin, now: tick(), input: { email: "desk@clinic.org", name: "Ama Mensah", role: "hospital", facilityId: real[0]!.id } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    hospitalUser = r.userId;
    oneTime = r.oneTimePassword;
    expect(oneTime).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    expect(await auth.checkPassword("desk@clinic.org", oneTime)).toBe(hospitalUser);
    expect(await profile(hospitalUser)).toMatchObject({ role: "hospital", facility_id: real[0]!.id, must_change_password: true, created_by: admin.userId });
    const [entry] = await historyFor(db, { profile_id: hospitalUser });
    expect(entry).toMatchObject({ action: "create_account", actor_id: admin.userId, actor_label: "boss@veriq.org", facility_id: real[0]!.id });
  });

  it("says what is missing, in plain words", async () => {
    const make = (input: Partial<Parameters<typeof createStaffAccount>[0]["input"]>) =>
      createStaffAccount({ db, auth, actor: admin, now: tick(), input: { email: "x@y.org", name: "Kofi", role: "hospital", ...input } });
    expect(await make({ email: "nope" })).toMatchObject({ ok: false, message: expect.stringMatching(/email/) });
    expect(await make({ name: "" })).toMatchObject({ ok: false, message: expect.stringMatching(/name/) });
    expect(await make({ role: "doctor" })).toMatchObject({ ok: false });
    expect(await make({})).toMatchObject({ ok: false, message: "Choose the hospital this person works at." });
    expect(await make({ facilityId: AKOMA })).toMatchObject({ ok: false, message: expect.stringMatching(/real facilities only/) });
    expect(await make({ role: "insurer" })).toMatchObject({ ok: false, message: "Choose the insurer this person works for." });
    // rule D2: Sika Health is an invented demo insurer; no real account links to it.
    expect(await make({ role: "insurer", insurerId: "a0000000-0000-4000-8000-000000000004" })).toMatchObject({
      ok: false,
      message: "Staff accounts link to real insurers only, not demo ones.",
    });
  });

  it("the demo admin can't touch staff accounts", async () => {
    expect(await createStaffAccount({ db, auth, actor: DEMO_ADMIN, now: tick(), input: { email: "a@b.org", name: "A B", role: "admin" } })).toMatchObject({ ok: false });
    expect(await resetStaffPassword({ db, auth, actor: DEMO_ADMIN, userId: hospitalUser, reason: "", now: tick() })).toMatchObject({ ok: false });
  });

  it("an insurer account links to its insurer", async () => {
    const r = await createStaffAccount({ db, auth, actor: admin, now: tick(), input: { email: "net@nhis.org", name: "Kojo", role: "insurer", insurerId: NHIS } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(await profile(r.userId)).toMatchObject({ role: "insurer", insurer_id: NHIS, facility_id: null });
  });

  it("re-links a hospital account to another facility, logged", async () => {
    expect(await linkAccount({ db, actor: admin, userId: hospitalUser, facilityId: real[1]!.id, now: tick() })).toEqual({ ok: true });
    expect((await profile(hospitalUser)).facility_id).toBe(real[1]!.id);
    expect((await historyFor(db, { profile_id: hospitalUser }))[0]).toMatchObject({ action: "link_account" });
    await linkAccount({ db, actor: admin, userId: hospitalUser, facilityId: real[0]!.id, now: tick() });
  });

  it("a password reset gives a new one-time password; the old one and old sessions stop working", async () => {
    const before = tick();
const later = tick();
    const r = await resetStaffPassword({ db, auth, actor: admin, userId: hospitalUser, reason: "Forgot it", now: later });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await auth.checkPassword("desk@clinic.org", oneTime)).toBeNull();
    expect(await auth.checkPassword("desk@clinic.org", r.oneTimePassword)).toBe(hospitalUser);
    const p = await profile(hospitalUser);
    expect(p.must_change_password).toBe(true);
    expect(staffFromProfile(p, before.getTime())).toBeNull(); // a session from before the reset
    expect((await historyFor(db, { profile_id: hospitalUser }))[0]).toMatchObject({ action: "reset_password", reason: "Forgot it" });
  });

  it("a disabled account can't sign in; switching it back on works", async () => {
    const r = await resetStaffPassword({ db, auth, actor: admin, userId: hospitalUser, reason: "test", now: tick() });
    if (!r.ok) throw new Error(r.message);
    expect(await setAccountDisabled({ db, auth, actor: admin, userId: hospitalUser, disabled: true, reason: "", now: tick() })).toMatchObject({ ok: false });
    expect(await setAccountDisabled({ db, auth, actor: admin, userId: hospitalUser, disabled: true, reason: "Left the job", now: tick() })).toEqual({ ok: true });
    expect(await auth.checkPassword("desk@clinic.org", r.oneTimePassword)).toBeNull();
    expect(staffFromProfile(await profile(hospitalUser), Date.now())).toBeNull();
    expect(await setAccountDisabled({ db, auth, actor: admin, userId: hospitalUser, disabled: false, reason: "Back", now: tick() })).toEqual({ ok: true });
    expect(await auth.checkPassword("desk@clinic.org", r.oneTimePassword)).toBe(hospitalUser);
  });

  it("an admin can't switch off their own account", async () => {
    expect(await setAccountDisabled({ db, auth, actor: admin, userId: admin.userId!, disabled: true, reason: "oops", now: tick() })).toMatchObject({
      ok: false,
      message: "You can't switch off your own account.",
    });
  });

  it("lists accounts with what they are linked to", async () => {
    const list = await listStaff(db);
    expect(list.find((s) => s.email === "desk@clinic.org")?.linkedTo).toBe(real[0]!.name);
    expect(list.find((s) => s.email === "net@nhis.org")?.linkedTo).toBe("NHIS");
  });
});

describe("verifying a hospital", () => {
  const checks = { nameMatches: true, calledBack: true, knownNumber: "030 266 1234, GHS directory", note: "" };

  it("waits for verification once a hospital account claims it", async () => {
    const { waiting } = await listHospitalClaims(db, "nhia");
    expect(waiting.map((c) => c.facility.id)).toContain(real[0]!.id);
  });

  it("needs both checks and the number called", async () => {
    expect(await verifyHospital({ db, actor: admin, facilityId: real[0]!.id, checks: { ...checks, nameMatches: false }, now: tick() })).toMatchObject({ ok: false });
    expect(await verifyHospital({ db, actor: admin, facilityId: real[0]!.id, checks: { ...checks, calledBack: false }, now: tick() })).toMatchObject({ ok: false });
    expect(await verifyHospital({ db, actor: admin, facilityId: real[0]!.id, checks: { ...checks, knownNumber: "" }, now: tick() })).toMatchObject({ ok: false });
  });

  it("an insurer can't verify, and the demo admin can't verify a real hospital", async () => {
    const insurer: Staff = { ...admin, role: "insurer" };
    expect(await verifyHospital({ db, actor: insurer, facilityId: real[0]!.id, checks, now: tick() })).toMatchObject({ ok: false });
    expect(await verifyHospital({ db, actor: DEMO_ADMIN, facilityId: real[0]!.id, checks, now: tick() })).toMatchObject({ ok: false });
  });

  it("marks it verified with who and when, logs the checks, and lets its staff publish", async () => {
    expect(await verifyHospital({ db, actor: admin, facilityId: real[0]!.id, checks, now: tick() })).toEqual({ ok: true });
    const f = (await pg.query<{ verified: boolean; verified_at: Date; verified_by: string }>("select * from public.facilities where id = $1", [real[0]!.id])).rows[0]!;
    expect(f.verified).toBe(true);
    expect(f.verified_by).toBe(admin.userId);
    expect(new Date(f.verified_at).getTime()).toBe(clock);
    const [entry] = await historyFor(db, { facility_id: real[0]!.id });
    expect(entry).toMatchObject({ action: "verify_hospital", actor_label: "boss@veriq.org" });
    expect((entry as AdminActionRow).details).toMatchObject({ known_number: "030 266 1234, GHS directory", called_back: true });
    const staff = { ...admin, role: "hospital" as const, facilityId: real[0]!.id };
    expect(canPublish(staff, { id: real[0]!.id, verified: f.verified })).toBe(true);
    expect((await listHospitalClaims(db, "nhia")).verified.map((c) => c.facility.id)).toContain(real[0]!.id);
  });

  it("removing verification needs a reason and is logged", async () => {
    expect(await unverifyHospital({ db, actor: admin, facilityId: real[0]!.id, reason: "", now: tick() })).toMatchObject({ ok: false });
    expect(await unverifyHospital({ db, actor: admin, facilityId: real[0]!.id, reason: "Wrong person", now: tick() })).toEqual({ ok: true });
    expect((await historyFor(db, { facility_id: real[0]!.id }))[0]).toMatchObject({ action: "unverify_hospital", reason: "Wrong person" });
  });
});

describe("held reports (rule A)", () => {
  let held: string[];

  beforeAll(async () => {
    const { rows } = await pg.query<{ id: string }>(
      `insert into public.card_reports (facility_id, insurer_id, outcome, device_hash, state)
       select $1, $2, 'refused', 'hash-' || g, 'held' from generate_series(1, 3) g returning id`,
      [AKOMA, NHIS],
    );
    held = rows.map((r) => r.id);
  });

  const publicCount = async (id: string) =>
    (await pg.query<{ n: number }>("select count(*)::int n from public.public_card_reports where id = $1", [id])).rows[0]!.n;

  it("lists held reports for the mode's facilities, without device hashes (rule 2)", async () => {
    const list = await listHeldReports(db, "demo");
    expect(list.map((r) => r.id)).toEqual(expect.arrayContaining(held));
    expect(list[0]).not.toHaveProperty("device_hash");
    expect(await listHeldReports(db, "nhia")).toEqual([]);
  });

  it("a held report doesn't count", async () => {
    expect(await publicCount(held[0]!)).toBe(0);
  });

  it("released: counts from then on, logged with the reason", async () => {
    expect(await reviewHeldReport({ db, actor: admin, reportId: held[0]!, decision: "release", reason: "Real patients, a busy clinic day", now: tick() })).toEqual({ ok: true });
    expect(await publicCount(held[0]!)).toBe(1);
    const [entry] = await historyFor(db, { facility_id: AKOMA });
    expect(entry).toMatchObject({ action: "release_report", report_id: held[0], reason: "Real patients, a busy clinic day" });
  });

  it("rejected: never counts, and can't be released later", async () => {
    expect(await reviewHeldReport({ db, actor: admin, reportId: held[1]!, decision: "reject", reason: "Same phone pattern", now: tick() })).toEqual({ ok: true });
    expect(await publicCount(held[1]!)).toBe(0);
    expect(await reviewHeldReport({ db, actor: admin, reportId: held[1]!, decision: "release", reason: "changed my mind", now: tick() })).toMatchObject({
      ok: false,
      message: "That report was already rejected.",
    });
  });

  it("needs a reason; the demo admin may review demo reports", async () => {
    expect(await reviewHeldReport({ db, actor: admin, reportId: held[2]!, decision: "reject", reason: "", now: tick() })).toMatchObject({ ok: false });
    expect(await reviewHeldReport({ db, actor: DEMO_ADMIN, reportId: held[2]!, decision: "reject", reason: "Rehearsal", now: tick() })).toEqual({ ok: true });
    expect((await historyFor(db, { facility_id: AKOMA }))[0]).toMatchObject({ actor_label: "Demo admin", actor_id: null });
  });
});

describe("locations (/admin/locations, rule D1)", () => {
  it("a real admin saves a location, logged with the point", async () => {
    expect(await saveLocation({ db, actor: admin, facilityId: real[2]!.id, text: "5.5612, -0.2601", now: tick() })).toEqual({ ok: true });
    expect((await historyFor(db, { facility_id: real[2]!.id }))[0]).toMatchObject({ action: "set_location", details: { to: [5.5612, -0.2601] } });
  });

  it("the demo admin can't change a real facility", async () => {
    expect(await saveLocation({ db, actor: DEMO_ADMIN, facilityId: real[2]!.id, text: "5.5612, -0.2601", now: tick() })).toMatchObject({ ok: false });
  });

  it("search matches name, district or area, in any case", () => {
    const f = { name: "Dansoman Polyclinic", district: "Ablekuma South", area: "Dansoman" };
    expect(matchesSearch(f, "dansoman")).toBe(true);
    expect(matchesSearch(f, "ABLEKUMA poly")).toBe(true);
    expect(matchesSearch(f, "tema")).toBe(false);
    expect(matchesSearch(f, "  ")).toBe(true);
  });

  it("finds the OpenStreetMap tile under a point", () => {
    // Accra (5.5612, -0.2601) at zoom 16 is in tile column 32720.
    const t = tileFor(5.5612, -0.2601, 16);
    expect(t.x).toBe(32720);
    expect(t.y).toBeGreaterThan(31700);
    expect(t.px).toBeGreaterThanOrEqual(0);
    expect(t.px).toBeLessThan(256);
  });
});
