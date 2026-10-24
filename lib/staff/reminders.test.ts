// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/db/fake-postgrest";
import { createDb } from "@/lib/db/pglite";
import { memoryMessenger } from "@/lib/messaging";
import { sendMorningReminders } from "./reminders";

let pg: PGlite;
beforeAll(async () => {
  pg = await createDb();
}, 60_000);
afterAll(async () => {
  await pg?.close();
});

describe("rule M: the 07:30 morning-check reminder", () => {
  it("texts the demo hospital's contact at 07:30 with a link to the check", async () => {
    const messenger = memoryMessenger();
    const result = await sendMorningReminders({
      db: fakeDb(pg),
      messenger,
      now: new Date("2026-10-24T07:30:00Z"),
      checkUrl: "https://veriq.test/h/check",
    });
    expect(result).toEqual({ sent: 1, skipped: null });
    expect(messenger.sent).toEqual([
      {
        to: "+233000000101",
        text: "Veriq: good morning, Akoma Mission Hospital. Please do your 30-second morning check: https://veriq.test/h/check",
      },
    ]);
  });

  it("sends nothing before 07:30", async () => {
    const messenger = memoryMessenger();
    const result = await sendMorningReminders({
      db: fakeDb(pg),
      messenger,
      now: new Date("2026-10-24T07:29:00Z"),
      checkUrl: "https://veriq.test/h/check",
    });
    expect(result).toEqual({ sent: 0, skipped: "before-07:30" });
    expect(messenger.sent).toEqual([]);
  });
});
