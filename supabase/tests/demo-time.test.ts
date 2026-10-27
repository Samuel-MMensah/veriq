// @vitest-environment node
// Rule F, demo data only: public.demo_until_time() (migration 10) must agree with demoUntilTime()
// in lib/rules/demo-time.ts at every hour of the day, so a reset at any hour reads the same in the
// database as the rule tests promise.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/pglite";
import { demoUntilTime } from "@/lib/rules/demo-time";

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function sqlUntil(at: Date): Promise<string | null> {
  const { rows } = await db.query<{ t: string | null }>("select public.demo_until_time($1::timestamptz)::text as t", [at.toISOString()]);
  return rows[0]!.t;
}

describe("demo till time in the database (migration 10) matches the rule", () => {
  it("at the five reset times the team named: 07:00, 11:00, 18:00, 21:23, 23:59", async () => {
    const cases: [string, string | null][] = [
      ["07:00", "12:00:00"],
      ["11:00", "15:00:00"],
      ["18:00", "20:00:00"],
      ["21:23", null],
      ["23:59", null],
    ];
    for (const [hhmm, expected] of cases) {
      const at = new Date(`2026-10-27T${hhmm}:00Z`);
      expect(await sqlUntil(at), hhmm).toBe(expected);
      expect(demoUntilTime(at), hhmm).toBe(expected);
    }
  });

  it("every 30 minutes through a day", async () => {
    for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
      const at = new Date(Date.UTC(2026, 9, 27, 0, minutes));
      expect(await sqlUntil(at), at.toISOString()).toBe(demoUntilTime(at));
    }
  });

  it("'Reset demo data' gives no demo till time outside 12:00 to 20:00, and never 'Was open'", async () => {
    await db.exec("select public.reset_demo()");
    const { rows } = await db.query<{ until_time: string | null }>(
      `select s.until_time::text from public.current_status s join public.facilities f on f.id = s.facility_id
       where f.source = 'demo' and s.until_time is not null`,
    );
    for (const r of rows) expect(r.until_time).toMatch(/^(1[2-9]|20):00:00$/);
  });
});
