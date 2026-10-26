// Prompt 10: makes the first Veriq admin. Run once, on the computer that holds .env.local:
//   npm run create-admin -- you@example.org
// It prints a one-time password here, in the terminal. Nothing is emailed. Sign in at /staff/sign-in
// with it, and you will be asked to set your own password. Later admins are made in the app.
import { createClient } from "@supabase/supabase-js";
import { createFirstAdmin } from "../lib/auth/create-admin.ts";
import type { AuthBackend } from "../lib/auth/backend.ts";
import type { Db } from "../lib/db/supabase.ts";

const emailText = process.argv[2];
if (!emailText) {
  console.error("Give the new admin's email: npm run create-admin -- you@example.org");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const notHere = () => Promise.reject(new Error("Not used by this script."));
const auth: AuthBackend = {
  async createUser(email, password) {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    return error || !data.user ? { ok: false, message: error?.message ?? "No user came back." } : { ok: true, userId: data.user.id };
  },
  checkPassword: notHere,
  setPassword: notHere,
  setBanned: notHere,
};

const result = await createFirstAdmin({ auth, db: supabase as unknown as Db, emailText });
if (!result.ok) {
  console.error(`Not made: ${result.message}`);
  process.exit(1);
}
console.log(`Admin made: ${result.email}`);
console.log(`One-time password: ${result.oneTimePassword}`);
console.log("Sign in at /staff/sign-in. You'll be asked to set your own password. This password is not stored anywhere else.");
