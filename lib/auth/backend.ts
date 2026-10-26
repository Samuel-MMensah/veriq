// Where staff passwords live (Prompt 10). On the real site: Supabase Auth, through its admin API with
// the service role. Accounts are made with the email already confirmed, so Supabase sends nothing.
// In local data mode (VERIQ_DATA=local): auth.users in the in-memory database, scrypt-hashed.
// Server only.
import type { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { isLocalData, localDb } from "@/lib/db/server";
import { getServiceSupabase } from "@/lib/db/supabase";
import { hashPassword, passwordMatches } from "./password";

export type CreateResult = { ok: true; userId: string } | { ok: false; message: string };

export interface AuthBackend {
  /** The user id when the email and password match an account that isn't banned, otherwise null. */
  checkPassword(email: string, password: string): Promise<string | null>;
  createUser(email: string, password: string): Promise<CreateResult>;
  setPassword(userId: string, password: string): Promise<void>;
  /** A banned account can't sign in at all (disabled by an admin). */
  setBanned(userId: string, banned: boolean): Promise<void>;
}

const EMAIL_TAKEN = "That email already has an account.";

export function pgliteAuth(db: PGlite): AuthBackend {
  return {
    async checkPassword(email, password) {
      const { rows } = await db.query<{ id: string; encrypted_password: string | null; banned: boolean }>(
        "select id, encrypted_password, coalesce(banned_until > now(), false) as banned from auth.users where lower(email) = lower($1)",
        [email],
      );
      const user = rows[0];
      if (!user || user.banned || !passwordMatches(password, user.encrypted_password)) return null;
      return user.id;
    },
    async createUser(email, password) {
      const taken = await db.query("select 1 from auth.users where lower(email) = lower($1)", [email]);
      if (taken.rows.length) return { ok: false, message: EMAIL_TAKEN };
      const { rows } = await db.query<{ id: string }>(
        "insert into auth.users (email, encrypted_password, email_confirmed_at) values ($1, $2, now()) returning id",
        [email, hashPassword(password)],
      );
      return { ok: true, userId: rows[0]!.id };
    },
    async setPassword(userId, password) {
      await db.query("update auth.users set encrypted_password = $2 where id = $1", [userId, hashPassword(password)]);
    },
    async setBanned(userId, banned) {
      await db.query("update auth.users set banned_until = $2 where id = $1", [userId, banned ? "infinity" : null]);
    },
  };
}

function supabaseAuth(): AuthBackend {
  const admin = () => getServiceSupabase().auth.admin;
  return {
    async checkPassword(email, password) {
      // A throwaway client: Veriq keeps its own session cookie (lib/auth/session.ts), not Supabase's.
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.user) return null;
      await client.auth.signOut({ scope: "local" });
      return data.user.id;
    },
    async createUser(email, password) {
      const { data, error } = await admin().createUser({ email, password, email_confirm: true });
      if (error || !data.user) {
        return { ok: false, message: /already|exists|registered/i.test(error?.message ?? "") ? EMAIL_TAKEN : `Could not make the account: ${error?.message}` };
      }
      return { ok: true, userId: data.user.id };
    },
    async setPassword(userId, password) {
      const { error } = await admin().updateUserById(userId, { password });
      if (error) throw new Error(`Could not set the password: ${error.message}`);
    },
    async setBanned(userId, banned) {
      // About 100 years; "none" lifts it.
      const { error } = await admin().updateUserById(userId, { ban_duration: banned ? "876000h" : "none" });
      if (error) throw new Error(`Could not change the account: ${error.message}`);
    },
  };
}

export async function getAuthBackend(): Promise<AuthBackend> {
  return isLocalData() ? pgliteAuth(await localDb()) : supabaseAuth();
}
