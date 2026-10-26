// @vitest-environment node
import type { ProfileRow } from "@/lib/db/types";
import { DEMO_ACCOUNTS, makeSession } from "./demo";
import {
  DEMO_ADMIN,
  actorLabel,
  adminMayAct,
  canPublish,
  makeAccountSession,
  readAccountSession,
  safeNext,
  staffFromDemo,
  staffFromProfile,
} from "./staff";

const SECRET = "test-secret";
const now = new Date("2026-10-26T08:00:00Z");
const UID = "c0000000-0000-4000-8000-000000000001";

const profile = (over: Partial<ProfileRow> = {}): ProfileRow => ({
  user_id: UID,
  role: "hospital",
  facility_id: "f1",
  insurer_id: null,
  phone: null,
  email: "desk@hospital.org",
  display_name: "Ama",
  disabled_at: null,
  must_change_password: false,
  sessions_valid_after: "2026-10-26T07:00:00.000Z",
  created_by: null,
  created_at: "2026-10-26T07:00:00.000Z",
  ...over,
});

describe("account session cookie (Prompt 10)", () => {
  it("round-trips the user id and issue time", () => {
    expect(readAccountSession(makeAccountSession(UID, SECRET, now), SECRET, now)).toEqual({ userId: UID, issuedAt: now.getTime() });
  });

  it("refuses another secret, an altered value and an expired one", () => {
    const cookie = makeAccountSession(UID, SECRET, now);
    expect(readAccountSession(cookie, "other", now)).toBeNull();
    expect(readAccountSession(`${cookie}x`, SECRET, now)).toBeNull();
    expect(readAccountSession(cookie, SECRET, new Date(now.getTime() + 8 * 3600_000))).toBeNull();
  });

  it("a demo cookie is not an account cookie", () => {
    // Same signing, different payload: no uid.
    expect(readAccountSession(makeSession("admin-demo", SECRET, now), SECRET, now)).toBeNull();
  });
});

describe("staff from profile (Prompt 10)", () => {
  it("an active profile signs in with its role and facility", () => {
    expect(staffFromProfile(profile(), now.getTime())).toMatchObject({ kind: "account", role: "hospital", facilityId: "f1", name: "Ama" });
  });

  it("a disabled account can't sign in, even with a valid cookie", () => {
    expect(staffFromProfile(profile({ disabled_at: "2026-10-26T07:30:00Z" }), now.getTime())).toBeNull();
  });

  it("a session from before a password reset is void", () => {
    expect(staffFromProfile(profile({ sessions_valid_after: "2026-10-26T08:00:00.001Z" }), now.getTime())).toBeNull();
    expect(staffFromProfile(profile({ sessions_valid_after: now.toISOString() }), now.getTime())).not.toBeNull();
  });

  it("no profile, no staff", () => {
    expect(staffFromProfile(null, now.getTime())).toBeNull();
  });

  it("a hospital account carries no insurer, an insurer account no facility", () => {
    expect(staffFromProfile(profile({ insurer_id: "i1" }), now.getTime())?.insurerId).toBeNull();
    expect(staffFromProfile(profile({ role: "insurer", insurer_id: "i1" }), now.getTime())).toMatchObject({ insurerId: "i1", facilityId: null });
  });

  it("carries the first-password flag", () => {
    expect(staffFromProfile(profile({ must_change_password: true }), now.getTime())?.mustChangePassword).toBe(true);
  });
});

describe("who may do what (Prompt 10)", () => {
  const hospital = staffFromProfile(profile(), now.getTime());
  const insurer = staffFromProfile(profile({ role: "insurer", insurer_id: "i1" }), now.getTime());
  const admin = staffFromProfile(profile({ role: "admin", facility_id: null }), now.getTime());

  it("only a verified hospital's own staff publish", () => {
    expect(canPublish(hospital, { id: "f1", verified: true })).toBe(true);
    expect(canPublish(hospital, { id: "f1", verified: false })).toBe(false);
    expect(canPublish(hospital, { id: "f2", verified: true })).toBe(false);
    expect(canPublish(admin, { id: "f1", verified: true })).toBe(false);
    expect(canPublish(null, { id: "f1", verified: true })).toBe(false);
  });

  it("an insurer or a hospital can't verify or act as admin", () => {
    expect(adminMayAct(insurer, { source: "nhia" })).toBe(false);
    expect(adminMayAct(hospital, { source: "nhia" })).toBe(false);
    expect(adminMayAct(insurer, "accounts")).toBe(false);
  });

  it("a real admin acts on everything", () => {
    expect(adminMayAct(admin, { source: "nhia" })).toBe(true);
    expect(adminMayAct(admin, { source: "demo" })).toBe(true);
    expect(adminMayAct(admin, "accounts")).toBe(true);
  });

  it("the demo admin touches demo facilities only, never real ones or accounts", () => {
    expect(adminMayAct(DEMO_ADMIN, { source: "demo" })).toBe(true);
    expect(adminMayAct(DEMO_ADMIN, { source: "nhia" })).toBe(false);
    expect(adminMayAct(DEMO_ADMIN, "accounts")).toBe(false);
  });

  it("logs who did it", () => {
    expect(actorLabel(admin!)).toBe("desk@hospital.org");
    expect(actorLabel(DEMO_ADMIN)).toBe("Demo admin");
  });

  it("demo accounts map to staff", () => {
    const akoma = staffFromDemo(DEMO_ACCOUNTS[0]!);
    expect(akoma).toMatchObject({ kind: "demo", role: "hospital", facilityId: "f0000000-0000-4000-8000-000000000001" });
  });
});

describe("safe next path (no open redirects)", () => {
  it("follows staff paths only", () => {
    expect(safeNext("/admin/staff")).toBe("/admin/staff");
    expect(safeNext("/h/check", "hospital")).toBe("/h/check");
    expect(safeNext("https://evil.example", "admin")).toBe("/admin");
    expect(safeNext("//evil.example", "insurer")).toBe("/i/network");
    expect(safeNext("/find")).toBe("/staff/sign-in");
    expect(safeNext(null, "hospital")).toBe("/h/check");
  });
});
