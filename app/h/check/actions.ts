"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/auth/session";
import { serviceDb } from "@/lib/db/server";
import { parseMorningForm, publishMorningCheck } from "@/lib/staff/morning-check";

/** "Confirm and publish" (rule M). Writes only for the signed-in hospital's facility. */
export async function publishAction(formData: FormData): Promise<void> {
  const staff = await currentStaff();
  if (staff?.role !== "hospital") redirect("/h/check");

  const entries = [...formData.entries()].filter((e): e is [string, string] => typeof e[1] === "string");
  let target: string;
  try {
    const result = await publishMorningCheck({
      db: await serviceDb(),
      facilityId: staff.facilityId,
      form: parseMorningForm(entries),
      now: new Date(),
    });
    target = `/h/check?published=${result.services}.${result.cards}.${result.answers}`;
  } catch (e) {
    target = `/h/check?error=${encodeURIComponent((e as Error).message)}`;
  }
  // Results, hospital pages and emergency mode read the new rows on their next request.
  revalidatePath("/", "layout");
  redirect(target);
}
