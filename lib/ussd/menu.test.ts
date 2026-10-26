// @vitest-environment node
// Screen 13: the USSD menu from the screen image, on the real seed in PGlite.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/db/fake-postgrest";
import { createDb } from "@/lib/db/pglite";
import { maskPhone } from "@/lib/messaging/console";
import { memoryMessenger } from "@/lib/messaging";
import { handleUssd, ROOT_MENU } from "./menu";

const PHONE = "+233244123456";
let pg: PGlite;

beforeAll(async () => {
  pg = await createDb();
}, 60_000);
afterAll(async () => {
  await pg?.close();
});

/** The demo line (rule D2), with REPORTS_LIVE off (rule R1): demo hospitals keep reporting. */
function dial(text: string, phone = PHONE, mode: { demoMode: boolean; reportsLive: boolean } = { demoMode: true, reportsLive: false }) {
  const messenger = memoryMessenger();
  const reply = handleUssd(
    { text, phone },
    { readDb: fakeDb(pg, "anon"), serviceDb: fakeDb(pg, "owner"), messenger, secret: "ussd-test", now: new Date(), ...mode },
  );
  return reply.then((r) => ({ reply: r, sms: messenger.sent }));
}

describe("USSD menu (screen 13)", () => {
  it("opens with the four choices", async () => {
    const { reply } = await dial("");
    expect(reply).toBe(`CON ${ROOT_MENU}`);
    expect(ROOT_MENU).toBe("VERIQ HEALTH\n1 Find hospital\n2 Is my card taken?\n3 Report refusal\n4 Emergency numbers");
  });

  it("1 asks for the card, then a private card, then the need, then the area", async () => {
    expect((await dial("1")).reply).toBe("CON Your card?\n1 NHIS\n2 Private\n3 No card");
    expect((await dial("1*2")).reply).toBe("CON Which private card?\n1 Cosmopolitan Health\n2 Prudential");
    expect((await dial("1*1")).reply).toMatch(/^CON Need\?\n1 Antenatal \/ maternity\n2 See a doctor\n3 Scan \/ X-ray/);
    expect((await dial("1*1*1")).reply).toMatch(/^CON Near\?\n1 Dansoman\n2 Kaneshie/);
  });

  it("1, NHIS, antenatal, Dansoman: ends and sends an SMS with the S1 order and sources", async () => {
    const { reply, sms } = await dial("1*1*1*1");
    expect(reply).toBe("END We sent you an SMS with 4 hospitals near Dansoman. Emergency? Call 112.");
    expect(sms).toHaveLength(1);
    expect(sms[0]!.to).toBe(PHONE);
    const text = sms[0]!.text;
    expect(text).toMatch(/^VERIQ \(sample data\): Antenatal \/ maternity, NHIS, near Dansoman\n/);
    expect(text).toContain("1) AKOMA MISSION HOSPITAL, Kaneshie 1.8km. NHIS: Confirmed by hospital 2 days ago.");
    expect(text).toMatch(/Antenatal clinic: Open till \d{1,2}(:\d{2})? (am|pm)/); // rule F: until_time
    expect(text).toContain("Scan top-up about GHS 80"); // SMS can't show ¢
    expect(text.indexOf("2) LAKESIDE")).toBeGreaterThan(text.indexOf("1) AKOMA"));
    expect(text.indexOf("3) GBAWE")).toBeGreaterThan(text.indexOf("2) LAKESIDE"));
    expect(text).not.toContain("4) "); // top 3 only
    expect(text).toContain("Dial again and choose 3 to report a refusal.");
  });

  it("1 with No card: lists hospitals without card lines", async () => {
    const { sms } = await dial("1*3*1*1");
    expect(sms[0]!.text).toMatch(/^VERIQ \(sample data\): Antenatal \/ maternity, no card, near Dansoman/);
    expect(sms[0]!.text).not.toMatch(/NHIS:/);
  });

  it("2, is my card taken: NHIS near Dansoman, best first, by SMS", async () => {
    expect((await dial("2")).reply).toBe("CON Your card?\n1 NHIS\n2 Private");
    const { reply, sms } = await dial("2*1*1");
    expect(reply).toMatch(/^END We sent you an SMS/);
    expect(sms[0]!.text).toMatch(/^VERIQ \(sample data\): NHIS near Dansoman\n1\) AKOMA MISSION HOSPITAL: Confirmed by hospital/);
  });

  it("3, report a refusal: picks a nearby hospital and counts it once (rule A)", async () => {
    const list = await dial("3*1*1");
    // Every hospital nearby, nearest first: a card can be refused anywhere.
    expect(list.reply).toMatch(/^CON Which hospital\?\n1 Little Steps Children's Clinic\n2 Akoma Mission Hospital\n/);
    const first = await dial("3*1*1*2"); // Akoma
    expect(first.reply).toMatch(/^END Thank you\. Your report is counted\./);
    const again = await dial("3*1*1*2");
    expect(again.reply).toMatch(/^END .*already counted/i);
    // Rule 2: the phone number is never stored, only a hash.
    const stored = await pg.query<{ device_hash: string }>("select device_hash from public.card_reports");
    expect(stored.rows.some((r) => r.device_hash.includes("244123456"))).toBe(false);
  });

  it("4 ends with the emergency numbers", async () => {
    expect((await dial("4")).reply).toBe(
      "END Emergency: call 112\nAmbulance: call 193\nYour card never stops emergency care.",
    );
  });

  it.each(["9", "1*9", "1*1*9", "1*1*1*99", "3*1*1*42", "1*1*1*1*1", "x"])("ends politely on a choice not on the menu (%s)", async (text) => {
    expect((await dial(text)).reply).toBe("END Sorry, that isn't on the menu. Please dial again.");
  });

  it("needs a phone number to send anything", async () => {
    expect((await dial("1*1*1*1", "")).reply).toMatch(/^END /);
  });
});

describe("console SMS stub (rule 2)", () => {
  it("masks the phone number to its last 3 digits", () => {
    expect(maskPhone("+233244123456")).toBe("***456");
  });
});

describe("USSD on the real directory (rules D2, R1 and 1)", () => {
  const real = { demoMode: false, reportsLive: false };

  it("3 Report refusal is closed on real hospitals while REPORTS_LIVE=off", async () => {
    // NHIS, then Dansoman: closed before any hospital is listed, and nothing is saved.
    const before = (await pg.query<{ n: number }>("select count(*)::int n from public.card_reports")).rows[0]!.n;
    const { reply } = await dial("3*1*1", PHONE, real);
    expect(reply).toBe("END Reporting opens soon. Call the hospital to check your card.");
    const after = (await pg.query<{ n: number }>("select count(*)::int n from public.card_reports")).rows[0]!.n;
    expect(after).toBe(before);
  });

  it("the demo line keeps reporting", async () => {
    expect((await dial("3*1*1")).reply).toMatch(/^CON Which hospital\?/);
  });

  it("never shows demo hospitals outside demo mode, and the SMS doesn't say sample data", async () => {
    const { reply, sms } = await dial("2*1*1", PHONE, real);
    expect(reply).not.toContain("Akoma");
    for (const m of sms) {
      expect(m.text).not.toContain("sample data");
      expect(m.text).not.toContain("AKOMA");
    }
  });
});
