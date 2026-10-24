// @vitest-environment node
// Screen 16 on the real seed: Akoma's morning check, published under rule M.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/db/fake-postgrest";
import { createDb } from "@/lib/db/pglite";
import { getFacilityDetail, getSearchCandidates, listServices } from "@/lib/db/queries";
import { badge } from "@/lib/rules/badge";
import { topUps } from "@/lib/rules/topup";
import { buildResults } from "@/lib/view/results";
import { loadMorningCheck, parseMorningForm, publishMorningCheck } from "./morning-check";

const AKOMA = "f0000000-0000-4000-8000-000000000001";
const NHIS = "a0000000-0000-4000-8000-000000000001";
const PRUDENTIAL = "a0000000-0000-4000-8000-000000000003";
const DANSOMAN = { lat: 5.545, lng: -0.265 };

let pg: PGlite;
beforeAll(async () => {
  pg = await createDb();
}, 60_000);
afterAll(async () => {
  await pg?.close();
});

const service = () => fakeDb(pg, "owner");
const statusRows = async () => (await pg.query<{ n: number }>("select count(*)::int n from public.status_updates where facility_id = $1", [AKOMA])).rows[0]!.n;

describe("loadMorningCheck (screen 16)", () => {
  it("shows Akoma's services with their toggles, its cards, the top-up prompt and the reach", async () => {
    const view = (await loadMorningCheck(service(), AKOMA, new Date()))!;
    expect(view.facilityName).toBe("Akoma Mission Hospital");
    const byLabel = Object.fromEntries(view.services.map((s) => [s.label, s]));
    expect(byLabel["Antenatal clinic"]).toMatchObject({ status: "open", options: [{ status: "open" }, { status: "closed" }] });
    expect(byLabel["Emergency unit"]).toMatchObject({ status: "accepting" });
    expect(byLabel["Obstetrician"]).toMatchObject({ status: "from_time", fromTime: "14:00" });
    expect(view.cards.map((c) => [c.name, c.says, c.due])).toEqual([
      ["Cosmopolitan Health", "accepts", false],
      ["NHIS", "accepts", false],
      ["Prudential", null, true],
    ]);
    expect(view.prompts).toEqual([{ insurerId: NHIS, item: "scan", count: 3, amountGhs: 80, cardName: "NHIS", itemLabel: "scan" }]);
    expect(view.reachLastWeek).toBe(214);
  });
});

describe("parseMorningForm", () => {
  it("reads statuses, times, cards and prompt answers", () => {
    expect(
      parseMorningForm([
        ["status:antenatal", "closed"],
        ["status:obstetrician", "from_time"],
        ["time:obstetrician", "15:30"],
        ["card:abc", "partial"],
        ["card:bad", "maybe"],
        ["prompt:abc:scan", "correct"],
        ["amount:abc:scan", "GH¢ 60"],
      ]),
    ).toEqual({
      statuses: [
        { serviceId: "antenatal", status: "closed", fromTime: null },
        { serviceId: "obstetrician", status: "from_time", fromTime: "15:30" },
      ],
      cards: [{ insurerId: "abc", says: "partial" }],
      prompts: [{ insurerId: "abc", item: "scan", answer: "correct", amountGhs: 60 }],
    });
  });
});

describe("publishMorningCheck (rule M)", () => {
  it("antenatal Closed: one new status row, and the results page shows Closed (rules M, F, S1)", async () => {
    const before = await statusRows();
    const result = await publishMorningCheck({
      db: service(),
      facilityId: AKOMA,
      form: {
        statuses: [
          { serviceId: "antenatal", status: "closed", fromTime: null },
          { serviceId: "emergency", status: "accepting", fromTime: null }, // unchanged, 40 min old
        ],
        cards: [],
        prompts: [],
      },
      now: new Date(),
    });
    expect(result).toEqual({ services: 1, cards: 0, answers: 0 });
    expect(await statusRows()).toBe(before + 1);

    const t = new Date();
    const services = new Map((await listServices(fakeDb(pg, "anon"))).map((s) => [s.id, s.name]));
    const results = buildResults({
      candidates: await getSearchCandidates(fakeDb(pg, "anon"), { serviceIds: ["antenatal"], insurerId: NHIS, ...DANSOMAN, radiusKm: 5, now: t }),
      serviceNames: services,
      withCard: true,
      origin: DANSOMAN,
      radiusKm: 5,
      now: t,
    });
    const akoma = results.cards.find((c) => c.name === "Akoma Mission Hospital")!;
    expect(akoma.status).toMatchObject({ word: "Closed", tone: "bad", sourceText: "updated by hospital just now" });
    expect(results.cards[0]!.name).toBe("Akoma Mission Hospital"); // still B2, so still first (rule S1)
  });

  it("confirming Prudential sets hospital_confirmed_at, so it becomes B2 (rules M and B2)", async () => {
    const result = await publishMorningCheck({
      db: service(),
      facilityId: AKOMA,
      form: { statuses: [], cards: [{ insurerId: PRUDENTIAL, says: "accepts" }], prompts: [] },
      now: new Date(),
    });
    expect(result.cards).toBe(1);
    const detail = (await getFacilityDetail(fakeDb(pg, "anon"), AKOMA, new Date()))!;
    const link = detail.links.find((l) => l.insurer_id === PRUDENTIAL)!;
    expect(link).toMatchObject({ hospital_says: "accepts", listed_by: "insurer" });
    expect(badge({ link, reports: [], now: new Date() })).toMatchObject({ id: "B2", text: "Confirmed by hospital just now" });
  });

  it("'Yes, show it' confirms the GH¢ 80 scan top-up; the prompt goes away (rules M and T)", async () => {
    await publishMorningCheck({
      db: service(),
      facilityId: AKOMA,
      form: { statuses: [], cards: [], prompts: [{ insurerId: NHIS, item: "scan", answer: "confirm", amountGhs: null }] },
      now: new Date(),
    });
    const detail = (await getFacilityDetail(fakeDb(pg, "anon"), AKOMA, new Date()))!;
    const nhis = (r: { insurer_id: string }) => r.insurer_id === NHIS;
    const [scan] = topUps({ reports: detail.reports.filter(nhis), responses: detail.responses.filter(nhis), now: new Date() });
    expect(scan).toMatchObject({ source: "hospital_confirmed", amountGhs: 80 });
    expect((await loadMorningCheck(service(), AKOMA, new Date()))!.prompts).toEqual([]);
  });

  it("refuses a service the hospital doesn't offer", async () => {
    await expect(
      publishMorningCheck({
        db: service(),
        facilityId: AKOMA,
        form: { statuses: [{ serviceId: "dental", status: "open", fromTime: null }], cards: [], prompts: [] },
        now: new Date(),
      }),
    ).rejects.toThrow(/isn't a service/);
  });

  it("only touches its own facility: another hospital's card can't be confirmed from Akoma", async () => {
    const SIKA = "a0000000-0000-4000-8000-000000000004"; // linked to Little Steps, not Akoma
    const result = await publishMorningCheck({
      db: service(),
      facilityId: AKOMA,
      form: { statuses: [], cards: [{ insurerId: SIKA, says: "does_not" }], prompts: [] },
      now: new Date(),
    });
    expect(result.cards).toBe(0);
    const other = await pg.query<{ hospital_says: string }>(
      "select hospital_says from public.facility_insurers where insurer_id = $1",
      [SIKA],
    );
    expect(other.rows.map((r) => r.hospital_says)).toEqual(["partial"]);
  });
});
