"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { serviceDb } from "@/lib/db/server";
import { parseMorningForm, publishMorningCheck } from "@/lib/staff/morning-check";

/**
 * "Confirm and publish" (rule M). Writes only for the signed-in hospital's own facility, and only
 * once Veriq has verified it (publishMorningCheck refuses otherwise, Prompt 10).
 */
export async function publishAction(formData: FormData): Promise<void> {
  const staff = await requireStaff("hospital", "/h/check");
  if (!staff.facilityId) redirect("/h/check");

  const entries = [...formData.entries()].filter((e): e is [string, string] => typeof e[1] === "string");
  let target: string;
  try {
    const result = await publishMorningCheck({
      db: await serviceDb(),
      facilityId: staff.facilityId,
      createdBy: staff.userId,
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
