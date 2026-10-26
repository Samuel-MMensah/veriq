import {
  cardCheckDue,
  optionsFor,
  planCardConfirmations,
  planStatusRows,
  reminderDue,
  topUpPrompts,
  type CurrentStatusLike,
} from "./morning";
import { DAY_MS, HOUR_MS } from "./time";

const now = new Date("2026-10-24T07:40:00Z"); // 7:40 am in Accra (UTC)
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("rule M: what each service can be set to", () => {
  it("clinics are Open or Closed; units Accepting or Full; machines Working or Down", () => {
    expect(optionsFor("antenatal").map((o) => o.status)).toEqual(["open", "closed"]);
    expect(optionsFor("emergency").map((o) => o.status)).toEqual(["accepting", "full"]);
    expect(optionsFor("ultrasound").map((o) => o.status)).toEqual(["working", "down"]);
  });

  it("specialists are here now, from a time, or not today", () => {
    expect(optionsFor("obstetrician").map((o) => [o.status, o.label])).toEqual([
      ["open", "Here now"],
      ["from_time", "From"],
      ["closed", "Not today"],
    ]);
  });
});

describe("rule M: one status row per changed or re-confirmed service (team decision 2026-10-24)", () => {
  const current: CurrentStatusLike[] = [
    { service_id: "antenatal", status: "open", from_time: null, note: "Open till 4 pm", created_at: ago(2 * HOUR_MS) },
    { service_id: "emergency", status: "accepting", from_time: null, note: null, created_at: ago(2 * HOUR_MS) },
    { service_id: "obstetrician", status: "from_time", from_time: "14:00:00", note: null, created_at: ago(2 * HOUR_MS) },
  ];

  it("an unchanged status confirmed again within 10 minutes is a double submit: nothing new", () => {
    const rows = planStatusRows({
      current,
      submitted: [
        { serviceId: "antenatal", status: "closed", fromTime: null },
        { serviceId: "emergency", status: "accepting", fromTime: null },
        { serviceId: "obstetrician", status: "from_time", fromTime: "14:00" },
      ],
      now,
    });
    // These statuses are 2 hours old, so every service confirmed gets a fresh, dated row.
    expect(rows.map((r) => r.serviceId)).toEqual(["antenatal", "emergency", "obstetrician"]);
    // Confirmed 5 minutes ago: only the real change is written.
    const justNow = current.map((c) => ({ ...c, created_at: ago(5 * 60_000) }));
    expect(
      planStatusRows({
        current: justNow,
        submitted: [
          { serviceId: "antenatal", status: "closed", fromTime: null },
          { serviceId: "emergency", status: "accepting", fromTime: null },
        ],
        now,
      }),
    ).toEqual([{ serviceId: "antenatal", status: "closed", fromTime: null, untilTime: null, note: null }]);
  });

  it("a new specialist time is a change", () => {
    const rows = planStatusRows({ current, submitted: [{ serviceId: "obstetrician", status: "from_time", fromTime: "15:30" }], now });
    expect(rows).toEqual([{ serviceId: "obstetrician", status: "from_time", fromTime: "15:30", untilTime: null, note: null }]);
  });

  it("a service never set before is a change", () => {
    const rows = planStatusRows({ current, submitted: [{ serviceId: "ultrasound", status: "working", fromTime: null }], now });
    expect(rows).toHaveLength(1);
  });

  it("every confirmation is dated: an unchanged status is re-confirmed after 10 minutes, keeping its note (threshold)", () => {
    const old = [{ ...current[0]!, created_at: ago(10 * 60_000 + 1) }];
    expect(planStatusRows({ current: old, submitted: [{ serviceId: "antenatal", status: "open", fromTime: null }], now })).toEqual([
      { serviceId: "antenatal", status: "open", fromTime: null, untilTime: null, note: "Open till 4 pm" },
    ]);
    const ten = [{ ...current[0]!, created_at: ago(10 * 60_000) }];
    expect(planStatusRows({ current: ten, submitted: [{ serviceId: "antenatal", status: "open", fromTime: null }], now })).toEqual([]);
  });

  it("a service left blank is not written (nothing is claimed for it)", () => {
    expect(planStatusRows({ current, submitted: [], now })).toEqual([]);
  });

  it("refuses a status that doesn't fit the service, or a time without 'From'", () => {
    expect(() => planStatusRows({ current, submitted: [{ serviceId: "antenatal", status: "full", fromTime: null }], now })).toThrow();
    expect(() => planStatusRows({ current, submitted: [{ serviceId: "obstetrician", status: "from_time", fromTime: null }], now })).toThrow();
    expect(() => planStatusRows({ current, submitted: [{ serviceId: "obstetrician", status: "from_time", fromTime: "25:00" }], now })).toThrow();
  });
});

describe("rule M: cards they confirm", () => {
  const links = [
    { insurer_id: "nhis", hospital_says: "accepts" as const, hospital_confirmed_at: ago(2 * DAY_MS) },
    { insurer_id: "prudential", hospital_says: null, hospital_confirmed_at: null },
  ];

  it("sets the answer and hospital_confirmed_at = now for every card they confirm", () => {
    expect(
      planCardConfirmations({
        links,
        answers: [
          { insurerId: "nhis", says: "partial" },
          { insurerId: "prudential", says: "does_not" },
          { insurerId: "unknown-card", says: "accepts" },
        ],
        now,
      }),
    ).toEqual([
      { insurerId: "nhis", hospital_says: "partial", hospital_confirmed_at: now.toISOString() },
      { insurerId: "prudential", hospital_says: "does_not", hospital_confirmed_at: now.toISOString() },
    ]);
  });

  it("the weekly card check is due when a card wasn't confirmed in the last 7 days (threshold)", () => {
    expect(cardCheckDue({ hospital_confirmed_at: ago(7 * DAY_MS) }, now)).toBe(false);
    expect(cardCheckDue({ hospital_confirmed_at: ago(7 * DAY_MS + 1) }, now)).toBe(true);
    expect(cardCheckDue({ hospital_confirmed_at: null }, now)).toBe(true);
  });
});

describe("rule M with rule T: prompts to confirm or correct patient-reported top-ups", () => {
  const topup = (insurer_id: string, amount: number, age: number, item: "scan" | "drugs" = "scan") => ({
    insurer_id,
    outcome: "topup" as const,
    item,
    amount_ghs: amount,
    created_at: ago(age),
  });

  it("asks when 2 or more patients reported the same top-up this week (threshold: exactly 2, exactly 7 days)", () => {
    expect(topUpPrompts({ reports: [topup("nhis", 80, DAY_MS), topup("nhis", 80, 7 * DAY_MS)], responses: [], now })).toEqual([
      { insurerId: "nhis", item: "scan", count: 2, amountGhs: 80 },
    ]);
    expect(topUpPrompts({ reports: [topup("nhis", 80, DAY_MS), topup("nhis", 80, 7 * DAY_MS + 1)], responses: [], now })).toEqual([]);
  });

  it("uses the median rounded to GH¢ 5, per card and item, most reports first", () => {
    const reports = [
      topup("nhis", 78, DAY_MS),
      topup("nhis", 84, 2 * DAY_MS),
      topup("nhis", 80, 3 * DAY_MS),
      topup("cosmo", 50, DAY_MS, "drugs"),
      topup("cosmo", 60, DAY_MS, "drugs"),
    ];
    expect(topUpPrompts({ reports, responses: [], now })).toEqual([
      { insurerId: "nhis", item: "scan", count: 3, amountGhs: 80 },
      { insurerId: "cosmo", item: "drugs", count: 2, amountGhs: 55 },
    ]);
  });

  it("doesn't ask again once the hospital has answered after the newest report", () => {
    const reports = [topup("nhis", 80, 2 * DAY_MS), topup("nhis", 80, DAY_MS)];
    const answered = [{ insurer_id: "nhis", kind: "confirm_topup" as const, item: "scan" as const, created_at: ago(HOUR_MS) }];
    expect(topUpPrompts({ reports, responses: answered, now })).toEqual([]);
    const older = [{ ...answered[0]!, created_at: ago(3 * DAY_MS) }];
    expect(topUpPrompts({ reports, responses: older, now })).toHaveLength(1);
  });

  it("ignores held reports (rule A)", () => {
    const reports = [topup("nhis", 80, DAY_MS), { ...topup("nhis", 80, DAY_MS), state: "held" as const }];
    expect(topUpPrompts({ reports, responses: [], now })).toEqual([]);
  });
});

describe("rule M: the 07:30 SMS reminder", () => {
  it("is due from 07:30 Accra time, once a day", () => {
    expect(reminderDue(new Date("2026-10-24T07:29:59Z"), null)).toBe(false);
    expect(reminderDue(new Date("2026-10-24T07:30:00Z"), null)).toBe(true);
    expect(reminderDue(new Date("2026-10-24T09:00:00Z"), "2026-10-24")).toBe(false);
    expect(reminderDue(new Date("2026-10-24T09:00:00Z"), "2026-10-23")).toBe(true);
  });
});

describe("rule F: an optional till time per service (Prompt 10)", () => {
  // now is 7:40 am in Accra.
  const base = { serviceId: "antenatal", status: "open" as const, fromTime: null };

  it("saves a till time later today", () => {
    expect(planStatusRows({ current: [], submitted: [{ ...base, untilTime: "16:00" }], now })).toEqual([
      { serviceId: "antenatal", status: "open", fromTime: null, untilTime: "16:00", note: null },
    ]);
  });

  it("no till time is fine, and is stored as none", () => {
    expect(planStatusRows({ current: [], submitted: [{ ...base, untilTime: "" }], now })[0]!.untilTime).toBeNull();
  });

  it("refuses a till time that has already passed today, or comes before the 'from' time", () => {
    expect(() => planStatusRows({ current: [], submitted: [{ ...base, untilTime: "07:30" }], now })).toThrow(/already passed/);
    expect(() =>
      planStatusRows({ current: [], submitted: [{ serviceId: "obstetrician", status: "from_time", fromTime: "14:00", untilTime: "13:00" }], now }),
    ).toThrow(/after the "from" time/);
    expect(() => planStatusRows({ current: [], submitted: [{ ...base, untilTime: "4pm" }], now })).toThrow(/till/);
  });

  it("a changed till time is a change, even within 10 minutes", () => {
    const current: CurrentStatusLike[] = [
      { service_id: "antenatal", status: "open", from_time: null, until_time: "16:00:00", note: null, created_at: ago(5 * 60_000) },
    ];
    expect(planStatusRows({ current, submitted: [{ ...base, untilTime: "16:00" }], now })).toEqual([]);
    expect(planStatusRows({ current, submitted: [{ ...base, untilTime: "17:00" }], now })).toHaveLength(1);
    expect(planStatusRows({ current, submitted: [{ ...base, untilTime: null }], now })).toHaveLength(1);
  });
});
