// @vitest-environment node
// Prompt 10, migration 8: disabled staff lose every power, only a verified hospital's staff publish,
// and the admin log is append-only (even for the table owner and the service role).
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb } from "@/lib/db/pglite";

const AKOMA = "f0000000-0000-4000-8000-000000000001"; // demo, verified
const VERIFIED_USER = "c0000000-0000-4000-8000-000000000001";
const UNVERIFIED_USER = "c0000000-0000-4000-8000-000000000002";
const ADMIN_USER = "c0000000-0000-4000-8000-000000000003";
const DISABLED_ADMIN = "c0000000-0000-4000-8000-000000000004";

let db: PGlite;
let realFacility: string;

const addStatus = (facility: string, user: string) =>
  db.query(
    "insert into public.status_updates (facility_id, service_id, status, source, created_by) values ($1, 'antenatal', 'open', 'hospital', $2)",
    [facility, user],
  );

beforeAll(async () => {
  db = await createDb();
  realFacility = (await db.query<{ id: string }>("select id from public.facilities where source = 'nhia' order by name limit 1")).rows[0]!.id;
  await db.exec(`
    insert into auth.users (id) values ('${VERIFIED_USER}'), ('${UNVERIFIED_USER}'), ('${ADMIN_USER}'), ('${DISABLED_ADMIN}');
    insert into public.profiles (user_id, role, facility_id, disabled_at) values
      ('${VERIFIED_USER}', 'hospital', '${AKOMA}', null),
      ('${UNVERIFIED_USER}', 'hospital', '${realFacility}', null),
      ('${ADMIN_USER}', 'admin', null, null),
      ('${DISABLED_ADMIN}', 'admin', null, now());
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("verified hospitals only (Prompt 10)", () => {
  it("a verified hospital's staff add status for their own facility", async () => {
    await as(db, "authenticated", VERIFIED_USER, async () => {
      await expect(addStatus(AKOMA, VERIFIED_USER)).resolves.toBeTruthy();
    });
  });

  it("an unverified hospital's staff can't publish a status or a hospital answer", async () => {
    await as(db, "authenticated", UNVERIFIED_USER, async () => {
      await expect(addStatus(realFacility, UNVERIFIED_USER)).rejects.toThrow();
      await expect(
        db.query(
          "insert into public.hospital_responses (facility_id, insurer_id, kind, created_by) values ($1, 'a0000000-0000-4000-8000-000000000001', 'dispute_refusals', $2)",
          [realFacility, UNVERIFIED_USER],
        ),
      ).rejects.toThrow();
    });
  });

  it("verified needs a time", async () => {
    await expect(db.query("update public.facilities set verified = true, verified_at = null where id = $1", [realFacility])).rejects.toThrow();
  });
});

describe("disabled accounts (Prompt 10)", () => {
  it("a disabled admin is not an admin and reads nothing private", async () => {
    await as(db, "authenticated", DISABLED_ADMIN, async () => {
      expect((await db.query<{ a: boolean }>("select public.is_admin() a")).rows[0]!.a).toBe(false);
      expect((await db.query("select * from public.card_reports")).rows).toHaveLength(0);
    });
  });

  it("an active admin reads raw reports", async () => {
    await as(db, "authenticated", ADMIN_USER, async () => {
      expect((await db.query("select * from public.card_reports")).rows.length).toBeGreaterThan(0);
    });
  });
});

describe("admin log is append-only (Prompt 10)", () => {
  it("an admin adds rows as themselves only", async () => {
    await as(db, "authenticated", ADMIN_USER, async () => {
      await db.query("insert into public.admin_actions (actor_id, actor_label, action, facility_id, reason) values ($1, 'a@b.c', 'verify_hospital', $2, 'called back')", [
        ADMIN_USER,
        realFacility,
      ]);
      await expect(
        db.query("insert into public.admin_actions (actor_id, actor_label, action) values ($1, 'x', 'verify_hospital')", [VERIFIED_USER]),
      ).rejects.toThrow();
    });
  });

  it("nobody, not even the owner, can change or delete a row", async () => {
    await expect(db.query("update public.admin_actions set reason = 'changed'")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from public.admin_actions")).rejects.toThrow(/append-only/);
    await expect(db.query("truncate public.admin_actions")).rejects.toThrow(/append-only/);
  });

  it("hospital staff can't read the log", async () => {
    await as(db, "authenticated", VERIFIED_USER, async () => {
      expect((await db.query("select * from public.admin_actions")).rows).toHaveLength(0);
    });
  });

  it("the demo reset leaves the log alone", async () => {
    const before = (await db.query<{ n: number }>("select count(*)::int n from public.admin_actions")).rows[0]!.n;
    // Staff accounts link to real facilities only (lib/admin/staff.ts); this test one used a demo one.
    await db.query("delete from public.profiles where facility_id = $1", [AKOMA]);
    await db.query("select public.reset_demo()");
    expect((await db.query<{ n: number }>("select count(*)::int n from public.admin_actions")).rows[0]!.n).toBe(before);
  });
});
