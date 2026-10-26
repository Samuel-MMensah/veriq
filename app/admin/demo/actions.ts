"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { serviceDb } from "@/lib/db/server";

/** "Reset demo data": re-runs the seed (public.reset_demo) with the service role. Any admin; demo rows only. */
export async function resetDemoAction(): Promise<void> {
  await requireStaff("admin", "/admin/demo");
  const { error } = await (await serviceDb()).rpc("reset_demo");
  revalidatePath("/", "layout");
  redirect(error ? `/admin/demo?error=${encodeURIComponent(error.message)}` : `/admin/demo?reset=${Date.now()}`);
}
