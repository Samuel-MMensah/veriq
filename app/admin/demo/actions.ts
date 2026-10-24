"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/auth/session";
import { serviceDb } from "@/lib/db/server";

/** "Reset demo data": re-runs the seed (public.reset_demo) with the service role. Demo admin only. */
export async function resetDemoAction(): Promise<void> {
  const staff = await currentStaff();
  if (staff?.role !== "admin") redirect("/admin/demo");
  const { error } = await (await serviceDb()).rpc("reset_demo");
  revalidatePath("/", "layout");
  redirect(error ? `/admin/demo?error=${encodeURIComponent(error.message)}` : `/admin/demo?reset=${Date.now()}`);
}
