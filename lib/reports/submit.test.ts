// @vitest-environment node
// Prompt 5: reports through rule A, on the real seed in PGlite.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/db/fake-postgrest";
import { createDb } from "@/lib/db/pglite";
import { getFacilityDetail } from "@/lib/db/queries";
import { badge } from "@/lib/rules/badge";
import { ALREADY_COUNTED_MESSAGE, deviceHash } from "@/lib/rules/limits";
import { submitReport, validateReport } from "./submit";

const NHIS = "a0000000-0000-4000-8000-000000000001";
const AKOMA = "f0000000-0000-4000-8000-000000000001"; // B2 for NHIS in the seed
const GBAWE = "f0000000-0000-4000-8000-000000000003"; // B4 for NHIS in the seed
const SUNRISE = "f0000000-0000-4000-8000-000000000008";
const SECRET = "test-secret";

let pg: PGlite;
let now = new Date();
beforeAll(async () => {
  pg = await createDb();
  now = new Date();
}, 60_000);
afterAll(async () => {
  await pg?.close();
});

const service = () => fakeDb(pg, "owner");
let n = 0;
const device = () => `device-${++n}-${Math.random().toString(36).slice(2)}`;

// REPORTS_LIVE is off in these tests: demo hospitals keep reporting (rule R1).
const send = (body: Record<string, unknown>) =>
  submitReport({ db: service(), body, secret: SECRET, now: new Date(), reportsLive: false });

async function nhisBadge(facilityId: string) {
  const detail = (await getFacilityDetail(fakeDb(pg, "anon"), facilityId, new Date()))!;
  const link = detail.links.find((l) => l.insurer_id === NHIS) ?? null;
  return badge({ link, reports: detail.reports.filter((r) => r.insurer_id === NHIS), now: new Date() });
}

describe("rule B through reports: a 3rd refusal turns a hospital into B1", () => {
  it("B2 to B1: Akoma (hospital confirmed) after 3 refusals from 3 phones", async () => {
    expect((await nhisBadge(AKOMA)).id).toBe("B2");
    for (let i = 1; i <= 3; i++) {
      const result = await send({ deviceId: device(), facilityId: AKOMA, insurerId: NHIS, outcome: "refused" });
      expect(result.status).toBe("counted");
      expect((await nhisBadge(AKOMA)).id).toBe(i < 3 ? "B2" : "B1");
    }
  });

  it("B4 to B1: Gbawe (on the NHIA list) after 3 refusals from 3 phones", async () => {
    expect((await nhisBadge(GBAWE)).id).toBe("B4");
    for (let i = 1; i <= 3; i++) {
      await send({ deviceId: device(), facilityId: GBAWE, insurerId: NHIS, outcome: "refused" });
    }
    expect(await nhisBadge(GBAWE)).toMatchObject({ id: "B1", text: "Listed, but 3 patients were refused in the last 30 days" });
  });
});

describe("rule A: one report per phone per hospital per 7 days", () => {
  it("refuses a second report from the same phone politely, and stores nothing new", async () => {
    const phone = device();
    const first = await send({ deviceId: phone, facilityId: SUNRISE, insurerId: NHIS, outcome: "covered" });
    expect(first.status).toBe("counted");
    const before = await pg.query<{ n: number }>("select count(*)::int n from public.card_reports");

    const second = await send({ deviceId: phone, facilityId: SUNRISE, insurerId: NHIS, outcome: "refused" });
    expect(second).toEqual({ status: "already_counted", message: ALREADY_COUNTED_MESSAGE });
    const after = await pg.query<{ n: number }>("select count(*)::int n from public.card_reports");
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
  });

  it("the same phone can still report a different hospital", async () => {
    const phone = device();
    await send({ deviceId: phone, facilityId: SUNRISE, insurerId: NHIS, outcome: "covered" });
    expect((await send({ deviceId: phone, facilityId: GBAWE, insurerId: NHIS, outcome: "covered" })).status).toBe("counted");
  });
});

describe("rule A: what is stored (rule 2)", () => {
  it("stores the hash of the device id with the secret, never the device id", async () => {
    const phone = device();
    const result = await send({ deviceId: phone, facilityId: GBAWE, insurerId: NHIS, outcome: "topup", amountGhs: 50, item: "drugs" });
    expect(result.status).toBe("counted");
    const id = result.status === "counted" ? result.reportId : "";
    const row = (await pg.query<Record<string, unknown>>("select * from public.card_reports where id = $1", [id])).rows[0]!;
    expect(row.device_hash).toBe(deviceHash(phone, SECRET));
    expect(JSON.stringify(row)).not.toContain(phone);
    expect(row).toMatchObject({ outcome: "topup", item: "drugs", state: "live" });
    expect(Number(row.amount_ghs)).toBe(50);
  });
});

describe("rule A: more than 10 reports for one hospital in an hour are held", () => {
  it("holds the 11th, and held reports never count", async () => {
    // A fresh hospital row so earlier tests don't add to the hour's count.
    const fresh = "f0000000-0000-4000-8000-0000000000aa";
    await pg.query(
      `insert into public.facilities (id, name, type, region, district, area, lat, lng)
       values ($1, 'Burst Test Clinic', 'private', 'Greater Accra', 'Test', 'Test', 5.5, -0.2)`,
      [fresh],
    );
    const results = [];
    for (let i = 0; i < 11; i++) {
      results.push((await send({ deviceId: device(), facilityId: fresh, insurerId: NHIS, outcome: "refused" })).status);
    }
    expect(results.slice(0, 10).every((s) => s === "counted")).toBe(true);
    expect(results[10]).toBe("held");
    const live = await pg.query<{ n: number }>("select count(*)::int n from public.public_card_reports where facility_id = $1", [fresh]);
    expect(live.rows[0]!.n).toBe(10);
  });
});

describe("validateReport", () => {
  const ok = { deviceId: "d-1234567890", facilityId: AKOMA, insurerId: NHIS, outcome: "covered" };

  it("accepts a minimal report, and a top-up with amount and item", () => {
    expect(validateReport(ok).ok).toBe(true);
    expect(validateReport({ ...ok, outcome: "topup", amountGhs: 80, item: "scan", serviceId: "ultrasound" }).ok).toBe(true);
    expect(validateReport({ ...ok, outcome: "topup" }).ok).toBe(true); // amount and item are optional
  });

  it.each([
    ["no device id", { ...ok, deviceId: "" }],
    ["a bad facility id", { ...ok, facilityId: "akoma" }],
    ["a bad outcome", { ...ok, outcome: "maybe" }],
    ["an amount without a top-up", { ...ok, amountGhs: 80 }],
    ["an item without a top-up", { ...ok, item: "scan" }],
    ["a negative amount", { ...ok, outcome: "topup", amountGhs: -5 }],
    ["an amount over GH¢ 100,000", { ...ok, outcome: "topup", amountGhs: 100_001 }],
    ["an unknown item", { ...ok, outcome: "topup", item: "taxi" }],
    ["a name field", { ...ok, name: "Ama Mensah" }],
    ["a card number field", { ...ok, cardNumber: "12345678" }],
  ])("refuses %s", (_, body) => {
    expect(validateReport(body).ok).toBe(false);
  });

  it("refuses a hospital or card that doesn't exist", async () => {
    const result = await send({ ...ok, deviceId: device(), facilityId: "f0000000-0000-4000-8000-999999999999" });
    expect(result.status).toBe("invalid");
  });

  it("needs a server secret", async () => {
    await expect(submitReport({ db: service(), body: { ...ok, deviceId: device() }, secret: "", now, reportsLive: false })).rejects.toThrow();
  });
});

describe("rule R1: reports on real facilities", () => {
  const realFacility = async () =>
    (await pg.query<{ id: string }>("select id from public.facilities where source = 'nhia' order by name limit 1")).rows[0]!.id;
  const realReports = async (id: string) =>
    (await pg.query<{ n: number }>("select count(*)::int n from public.card_reports where facility_id = $1", [id])).rows[0]!.n;

  it("REPORTS_LIVE=off closes reports on a real facility, and nothing is saved", async () => {
    const id = await realFacility();
    const result = await submitReport({
      db: service(),
      body: { deviceId: device(), facilityId: id, insurerId: NHIS, outcome: "refused" },
      secret: SECRET,
      now: new Date(),
      reportsLive: false,
    });
    expect(result).toEqual({ status: "closed", message: "Reporting opens soon. Call the hospital to check your card." });
    expect(await realReports(id)).toBe(0);
  });

  it("demo facilities keep reporting with REPORTS_LIVE=off", async () => {
    const result = await send({ deviceId: device(), facilityId: SUNRISE, insurerId: NHIS, outcome: "covered" });
    expect(result.status).toBe("counted");
  });

  it("REPORTS_LIVE=on opens reports on a real facility (rule A still applies)", async () => {
    const id = await realFacility();
    const result = await submitReport({
      db: service(),
      body: { deviceId: device(), facilityId: id, insurerId: NHIS, outcome: "covered" },
      secret: SECRET,
      now: new Date(),
      reportsLive: true,
    });
    expect(result.status).toBe("counted");
    await pg.query("delete from public.card_reports where facility_id = $1", [id]);
  });
});
