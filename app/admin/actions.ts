"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseLocation } from "@/lib/admin/location";
import { currentStaff } from "@/lib/auth/session";
import { serviceDb } from "@/lib/db/server";

/** /admin "Needs a location": an admin sets a real facility's location by hand (rule D1, location_source = admin). */
export async function setLocationAction(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (staff?.role !== "admin") redirect("/admin");
  const id = String(formData.get("facility") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin?error=Unknown%20facility");
  const parsed = parseLocation(String(formData.get("location") ?? ""));
  if (!parsed.ok) redirect(`/admin?error=${encodeURIComponent(parsed.message)}#f-${id}`);

  const { error } = await (await serviceDb())
    .from("facilities")
    .update({ lat: parsed.lat, lng: parsed.lng, location_source: "admin", location_checked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("source", "nhia");
  revalidatePath("/", "layout");
  redirect(error ? `/admin?error=${encodeURIComponent(error.message)}` : `/admin?set=${id}`);
}
