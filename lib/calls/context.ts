// Prompt 10b: what the call form, the import and their checks need from the database.
import type { Db } from "@/lib/db/supabase";
import type { FacilityRow, InsurerRow, ServiceRow } from "@/lib/db/types";
import type { ImportContext, ImportFacility } from "./csv";
import type { CallContext } from "./input";
import { callerAccounts, listCalls } from "./record";

/** NHIS first, then the private cards by name: the order of the form, the CSV and the summary. */
export function cardOrder(insurers: InsurerRow[]): InsurerRow[] {
  return [...insurers].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "public" ? -1 : 1));
}

export async function loadCallContext(db: Db, now: Date): Promise<{ ctx: CallContext; insurers: InsurerRow[]; services: ServiceRow[] }> {
  const [ins, svc, callers] = await Promise.all([
    db.from("insurers").select("*"),
    db.from("services").select("*").order("name"),
    callerAccounts(db),
  ]);
  if (ins.error || svc.error) throw new Error(`Could not load cards and services: ${(ins.error ?? svc.error)!.message}`);
  const insurers = cardOrder((ins.data ?? []) as InsurerRow[]);
  const services = (svc.data ?? []) as ServiceRow[];
  return { ctx: { insurerIds: insurers.map((i) => i.id), serviceIds: services.map((s) => s.id), callers, now }, insurers, services };
}

/** Real facilities only (rule D2): calls are never made to invented demo hospitals. */
export async function listRealFacilities(db: Db): Promise<FacilityRow[]> {
  const { data, error } = await db.from("facilities").select("*").eq("source", "nhia").order("name");
  if (error) throw new Error(`Could not load facilities: ${error.message}`);
  return (data ?? []) as FacilityRow[];
}

export async function loadImportContext(db: Db, now: Date): Promise<ImportContext> {
  const [{ ctx, insurers }, facilities, calls] = await Promise.all([loadCallContext(db, now), listRealFacilities(db), listCalls(db)]);
  const facilitiesByRef = new Map<string, ImportFacility>();
  for (const f of facilities) if (f.source_ref) facilitiesByRef.set(f.source_ref, { id: f.id, name: f.name, source_ref: f.source_ref });
  return {
    ...ctx,
    cards: insurers.map((i) => ({ id: i.id, slug: i.slug })),
    facilitiesByRef,
    callerIdsByEmail: new Map([...ctx.callers].map(([id, email]) => [email, id])),
    existing: new Set(calls.map((c) => `${c.facility_id}|${new Date(c.called_at).toISOString()}`)),
  };
}
