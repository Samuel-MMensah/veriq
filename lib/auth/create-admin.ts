// The first admin (Prompt 10): made by `npm run create-admin -- you@example.org`, never by a migration.
// Shared by that script and by local data mode (VERIQ_LOCAL_ADMIN, for tests). Imports are relative
// with .ts so Node runs the script directly.
import type { PGlite } from "@electric-sql/pglite";
import type { Db } from "../db/supabase.ts";
import type { AuthBackend } from "./backend.ts";
import { normaliseEmail, oneTimePassword } from "./password.ts";

export type FirstAdminResult = { ok: true; email: string; oneTimePassword: string } | { ok: false; message: string };

/** Makes an admin account with a one-time password; the person sets their own on first sign-in. */
export async function createFirstAdmin({
  auth,
  db,
  emailText,
  password = oneTimePassword(),
  mustChange = true,
}: {
  auth: AuthBackend;
  db: Db;
  emailText: string;
  password?: string;
  mustChange?: boolean;
}): Promise<FirstAdminResult> {
  const email = normaliseEmail(emailText);
  if (!email) return { ok: false, message: `"${emailText}" isn't an email address.` };
  const created = await auth.createUser(email, password);
  if (!created.ok) return created;
  const profile = await db.from("profiles").insert({
    user_id: created.userId,
    role: "admin",
    email,
    must_change_password: mustChange,
  });
  if (profile.error) return { ok: false, message: `The login exists but the profile failed: ${profile.error.message}` };
  await db.from("admin_actions").insert({
    actor_id: null,
    actor_label: "create-admin script",
    action: "create_account",
    profile_id: created.userId,
    reason: "First admin",
    details: { role: "admin", email },
  });
  return { ok: true, email, oneTimePassword: password };
}

/**
 * Local data mode only: VERIQ_LOCAL_ADMIN="email:password" makes an admin in the throwaway in-memory
 * database, already past the first-password step, so e2e tests can sign in as a real admin.
 */
export async function seedLocalAdmin(db: PGlite): Promise<void> {
  const value = process.env.VERIQ_LOCAL_ADMIN;
  if (!value || process.env.VERIQ_DATA !== "local") return;
  const [emailText, password] = [value.slice(0, value.indexOf(":")), value.slice(value.indexOf(":") + 1)];
  const { pgliteAuth } = await import("./backend.ts");
  const { fakeDb } = await import("../db/fake-postgrest.ts");
  await createFirstAdmin({ auth: pgliteAuth(db), db: fakeDb(db, "owner"), emailText, password, mustChange: false });
}
