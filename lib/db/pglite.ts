// Runs the real migrations and seed in an in-memory Postgres (PGlite), so SQL is tested without
// Docker or a Supabase project. The shim stands in for the parts of Supabase the migrations use.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

// The project root: vitest and `next start` both run from it, and a server bundle has no source path.
const root = join(process.cwd(), "supabase");

const SUPABASE_SHIM = `
  create schema auth;
  -- The auth.users columns local sign-in uses (lib/auth/backend.ts), named as in Supabase.
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    encrypted_password text,
    email_confirmed_at timestamptz,
    banned_until timestamptz
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  -- Supabase's default: new tables, views and functions in public are granted to the API roles,
  -- and row-level security does the limiting.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export const seedSql = readFileSync(join(root, "seed.sql"), "utf8");

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  const dir = join(root, "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  await db.exec(seedSql);
  return db;
}

/** Run fn as an API role. userId sets auth.uid() for "authenticated". */
export async function as<T>(
  db: PGlite,
  role: "anon" | "authenticated",
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
