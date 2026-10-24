// Rule M: the 07:30 SMS reminder to each hospital's morning-check contact.
// Phase 1 sends to the demo hospital account through the console stub; Phase 2 (Prompt 10) adds
// real contacts from hospital onboarding.
import { DEMO_ACCOUNTS } from "@/lib/auth/demo";
import type { Db } from "@/lib/db/supabase";
import type { FacilityRow, ProfileRow } from "@/lib/db/types";
import type { Messenger } from "@/lib/messaging";
import { reminderDue } from "@/lib/rules/morning";

export async function sendMorningReminders({
  db,
  messenger,
  now,
  checkUrl,
}: {
  /** Service access: profiles are staff-only. */
  db: Db;
  messenger: Messenger;
  now: Date;
  /** e.g. https://veriq.example/h/check */
  checkUrl: string;
}): Promise<{ sent: number; skipped: "before-07:30" | null }> {
  if (!reminderDue(now, null)) return { sent: 0, skipped: "before-07:30" };

  const staff = await db.from("profiles").select("*").eq("role", "hospital");
  if (staff.error) throw new Error(`Could not load hospital staff: ${staff.error.message}`);
  const contacts = [
    ...DEMO_ACCOUNTS.flatMap((a) => (a.role === "hospital" ? [{ phone: a.phone, facilityId: a.facilityId }] : [])),
    ...((staff.data ?? []) as ProfileRow[]).flatMap((p) => (p.phone && p.facility_id ? [{ phone: p.phone, facilityId: p.facility_id }] : [])),
  ];

  let sent = 0;
  for (const c of contacts) {
    const f = await db.from("facilities").select("*").eq("id", c.facilityId).maybeSingle();
    const name = (f.data as FacilityRow | null)?.name ?? "your hospital";
    await messenger.sendSms(c.phone, `Veriq: good morning, ${name}. Please do your 30-second morning check: ${checkUrl}`);
    sent++;
  }
  return { sent, skipped: null };
}
