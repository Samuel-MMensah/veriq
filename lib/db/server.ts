// Database access for server components and API routes. Never import from a client component.
//
// VERIQ_DATA=local runs the real migrations and seed in an in-memory Postgres (PGlite) inside the
// server, so the app works without Supabase keys and e2e tests get fresh sample data on every start.
// Otherwise the app uses the Supabase project in .env.local.
import type { PGlite } from "@electric-sql/pglite";
import { getServiceSupabase, getSupabase, type Db } from "./supabase";

export function isLocalData(): boolean {
  return process.env.VERIQ_DATA === "local";
}

let local: Promise<PGlite> | null = null;

async function localDb(): Promise<PGlite> {
  local ??= import("./pglite").then((m) => m.createDb());
  return local;
}

/** Public reads: row-level security applies (the anon key, or the anon role locally). */
export async function readDb(): Promise<Db> {
  if (!isLocalData()) return getSupabase();
  const { fakeDb } = await import("./fake-postgrest");
  return fakeDb(await localDb(), "anon");
}

/** Server-only writes such as the search log: the service role (the table owner locally). */
export async function serviceDb(): Promise<Db> {
  if (!isLocalData()) return getServiceSupabase();
  const { fakeDb } = await import("./fake-postgrest");
  return fakeDb(await localDb(), "owner");
}
