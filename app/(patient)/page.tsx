import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Welcome } from "@/components/welcome/Welcome";
import { SEEN_COOKIE } from "@/lib/local/prefs";

export const metadata: Metadata = { title: "Know before you go" };

// Screen 7, first open. Shown once, then "/" goes to /find: on the server when the flag cookie is
// set (no welcome flash, one round trip less on 3G), else on the phone from localStorage.
export default async function FirstOpenPage() {
  if ((await cookies()).get(SEEN_COOKIE)) redirect("/find");
  return <Welcome />;
}
