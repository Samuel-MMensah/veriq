"use server";

// Admin actions (Prompt 10). Each one checks the signed-in admin, calls the tested logic in lib/admin
// (which writes the admin log), and refreshes the screens that show what changed.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/admin/form";
import { reviewHeldReport } from "@/lib/admin/reports";
import { saveLocation } from "@/lib/admin/save-location";
import { createStaffAccount, linkAccount, resetStaffPassword, setAccountDisabled } from "@/lib/admin/staff";
import { unverifyHospital, verifyHospital } from "@/lib/admin/verify";
import { getAuthBackend } from "@/lib/auth/backend";
import { requireStaff } from "@/lib/auth/session";
import { serviceDb } from "@/lib/db/server";

const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();
const admin = (path: string) => requireStaff("admin", path);

/** /admin/staff: make an account; the one-time password is shown once, in the form. */
export async function createAccountAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await admin("/admin/staff");
  const result = await createStaffAccount({
    db: await serviceDb(),
    auth: await getAuthBackend(),
    actor,
    now: new Date(),
    input: {
      email: text(fd, "email"),
      name: text(fd, "name"),
      role: text(fd, "role"),
      facilityId: text(fd, "facility") || undefined,
      insurerId: text(fd, "insurer") || undefined,
    },
  });
  if (!result.ok) return { error: result.message };
  revalidatePath("/admin", "layout");
  return {
    message: `Account made for ${result.email}`,
    secret: { label: `Give this one-time password to ${text(fd, "name")} by hand or by phone:`, value: result.oneTimePassword },
  };
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await admin("/admin/staff");
  const result = await resetStaffPassword({
    db: await serviceDb(),
    auth: await getAuthBackend(),
    actor,
    userId: text(fd, "user"),
    reason: text(fd, "reason"),
    now: new Date(),
  });
  if (!result.ok) return { error: result.message };
  revalidatePath("/admin", "layout");
  return { message: "Password reset", secret: { label: `New one-time password for ${result.email}:`, value: result.oneTimePassword } };
}

export async function setDisabledAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await admin("/admin/staff");
  const userId = text(fd, "user");
  const disabled = text(fd, "disabled") === "1";
  const result = await setAccountDisabled({
    db: await serviceDb(),
    auth: await getAuthBackend(),
    actor,
    userId,
    disabled,
    reason: text(fd, "reason"),
    now: new Date(),
  });
  if (!result.ok) return { error: result.message };
  revalidatePath("/admin", "layout");
  redirect(`/admin/staff/${userId}?done=${disabled ? "off" : "on"}`);
}

export async function linkAccountAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await admin("/admin/staff");
  const result = await linkAccount({
    db: await serviceDb(),
    actor,
    userId: text(fd, "user"),
    facilityId: text(fd, "facility") || undefined,
    insurerId: text(fd, "insurer") || undefined,
    now: new Date(),
  });
  if (!result.ok) return { error: result.message };
  revalidatePath("/admin", "layout");
  return { message: "Link saved." };
}

/** /admin/hospitals/[id]: the two checks, then verified (with who and when). */
export async function verifyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await admin("/admin/hospitals");
  const facilityId = text(fd, "facility");
  const result = await verifyHospital({
    db: await serviceDb(),
    actor,
    facilityId,
    checks: {
      nameMatches: fd.get("name_matches") === "on",
      calledBack: fd.get("called_back") === "on",
      knownNumber: text(fd, "known_number"),
      note: text(fd, "note"),
    },
    now: new Date(),
  });
  if (!result.ok) return { error: result.message };
  revalidatePath("/", "layout");
  redirect(`/admin/hospitals/${facilityId}?done=verified`);
}

export async function unverifyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await admin("/admin/hospitals");
  const facilityId = text(fd, "facility");
  const result = await unverifyHospital({ db: await serviceDb(), actor, facilityId, reason: text(fd, "reason"), now: new Date() });
  if (!result.ok) return { error: result.message };
  revalidatePath("/", "layout");
  redirect(`/admin/hospitals/${facilityId}?done=unverified`);
}

/** /admin/reports: release or reject a held report (rule A), after a confirmation, with a reason. */
export async function reviewReportAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await admin("/admin/reports");
  const decision = text(fd, "decision") === "release" ? "release" : "reject";
  const result = await reviewHeldReport({ db: await serviceDb(), actor, reportId: text(fd, "report"), decision, reason: text(fd, "reason"), now: new Date() });
  if (!result.ok) return { error: result.message };
  // A released report changes badges on the patient side (rule B).
  revalidatePath("/", "layout");
  redirect(`/admin/reports?done=${decision === "release" ? "released" : "rejected"}`);
}

/** /admin/locations: save a real facility's location by hand (rule D1). */
export async function setLocationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await admin("/admin/locations");
  const result = await saveLocation({ db: await serviceDb(), actor, facilityId: text(fd, "facility"), text: text(fd, "location"), now: new Date() });
  if (!result.ok) return { error: result.message };
  revalidatePath("/", "layout");
  // The facility leaves this list, so the answer shows at the top of the page.
  const q = text(fd, "q");
  redirect(`/admin/locations?saved=${encodeURIComponent(text(fd, "facility"))}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
}
