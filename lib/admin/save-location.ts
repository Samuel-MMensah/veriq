// /admin/locations: an admin saves a real facility's map location by hand (rule D1, location_source =
// admin). Real facilities only, real admins only, and the admin log keeps the old and new point.
import { adminMayAct, type Staff } from "@/lib/auth/staff";
import type { Db } from "@/lib/db/supabase";
import { parseLocation } from "./location";
import { fail, loadFacility, logAction, type AdminResult } from "./log";

export async function saveLocation({
  db,
  actor,
  facilityId,
  text,
  now,
}: {
  db: Db;
  actor: Staff;
  facilityId: string;
  text: string;
  now: Date;
}): Promise<AdminResult> {
  const facility = await loadFacility(db, facilityId);
  if (!facility || facility.source !== "nhia") return fail("Unknown facility.");
  if (!adminMayAct(actor, facility)) return fail("Only a signed-in Veriq admin can set a real facility's location.");
  const parsed = parseLocation(text);
  if (!parsed.ok) return parsed;
  const { error } = await db
    .from("facilities")
    .update({ lat: parsed.lat, lng: parsed.lng, location_source: "admin", location_checked_at: now.toISOString() })
    .eq("id", facility.id);
  if (error) return fail(`Could not save: ${error.message}`);
  await logAction(db, actor, now, {
    action: "set_location",
    facility_id: facility.id,
    details: { from: facility.lat === null ? null : [facility.lat, facility.lng], to: [parsed.lat, parsed.lng] },
  });
  return { ok: true };
}
