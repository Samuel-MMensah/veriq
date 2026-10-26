// Rule D2 on the server: is this request in demo mode? Pages pass their search params so ?demo=1
// works on the very first request, before proxy.ts's cookie comes back.
import { cookies } from "next/headers";
import { currentStaff } from "@/lib/auth/session";
import { demoModeFrom } from "@/lib/rules/directory";
import type { SearchParams } from "@/lib/view/catalog";

export const DEMO_COOKIE = "veriq_demo";
/** As long as a demo login lasts (lib/auth/demo.ts). */
export const DEMO_COOKIE_HOURS = 8;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function isDemoMode(searchParams?: SearchParams): Promise<boolean> {
  const param = first(searchParams?.demo);
  // Only read the staff cookie when it can change the answer.
  if (param === "1" || param === "0") return param === "1";
  const demoCookie = (await cookies()).get(DEMO_COOKIE)?.value;
  if (demoCookie === "1") return true;
  // Only the demo login turns demo mode on; a real account sees real facilities (rule D2).
  return demoModeFrom({ param, demoCookie, staffSignedIn: (await currentStaff())?.kind === "demo" });
}
