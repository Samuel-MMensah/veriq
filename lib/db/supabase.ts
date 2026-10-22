import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type Db = SupabaseClient<Database>;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local (see .env.example).`);
  return value;
}

let publicClient: Db | null = null;

/** Public client: anon key, row-level security applies. Safe for server components and the browser. */
export function getSupabase(): Db {
  publicClient ??= createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
  });
  return publicClient;
}

/**
 * Service-role client: bypasses row-level security. Server only (API routes such as /api/reports,
 * which applies rule A). Never import this from a client component.
 */
export function getServiceSupabase(): Db {
  if (typeof window !== "undefined") throw new Error("The service-role client is server only.");
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}
