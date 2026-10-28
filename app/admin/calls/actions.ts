"use server";

// Prompt 10b: record a verification call, and import calls recorded on paper. Each action checks the
// signed-in admin, runs the tested checks in lib/calls, and saves through record_verification_call().
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { loadCallContext, loadImportContext } from "@/lib/calls/context";
import { previewCallCsv, type ImportPreview } from "@/lib/calls/csv";
import { checkCall, type CallFormState } from "@/lib/calls/input";
import { recordCall } from "@/lib/calls/record";
import { serviceDb } from "@/lib/db/server";

const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

/** /admin/calls/new: one call, checked field by field. */
export async function recordCallAction(_prev: CallFormState, fd: FormData): Promise<CallFormState> {
  const actor = await requireStaff("admin", "/admin/calls");
  const db = await serviceDb();
  const { ctx } = await loadCallContext(db, new Date());
  const checked = checkCall(
    {
      facilityId: text(fd, "facility"),
      calledAt: text(fd, "called_at"),
      callerId: text(fd, "caller"),
      answeredRole: text(fd, "answered_role"),
      phone: text(fd, "phone"),
      answers: ctx.insurerIds.map((id) => ({ insurerId: id, answer: text(fd, `answer-${id}`), note: text(fd, `note-${id}`) })),
      services: fd.getAll("services").map(String),
      usualHours: text(fd, "usual_hours"),
      location: text(fd, "location"),
    },
    ctx,
  );
  const values = Object.fromEntries([...fd.entries()].filter(([k, v]) => k !== "services" && typeof v === "string")) as Record<string, string>;
  const kept = { values, services: fd.getAll("services").map(String) };
  if (!checked.ok) {
    return { error: "Check the marked fields.", fields: Object.fromEntries(checked.errors.map((e) => [e.field, e.message])), ...kept };
  }
  const result = await recordCall({ db, actor, payload: checked.payload });
  if (!result.ok) return { error: result.message, ...kept };
  // Badges, phone, services and location may all change on the patient side (rule B-V).
  revalidatePath("/", "layout");
  redirect(`/admin/calls?saved=${encodeURIComponent(result.facility.id)}`);
}

export type ImportState = { csv?: string; preview?: ImportPreview; saved?: number; skipped?: number; error?: string } | null;

async function readCsv(fd: FormData): Promise<string> {
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1_000_000) throw new Error("That file is too big for a call sheet (1 MB at most).");
    return await file.text();
  }
  return String(fd.get("csv") ?? "");
}

/** /admin/calls/import, step 1: read and check every row. Nothing is saved. */
export async function previewImportAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  await requireStaff("admin", "/admin/calls/import");
  let csv: string;
  try {
    csv = await readCsv(fd);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!csv.trim()) return { error: "Choose a CSV file, or paste the rows." };
  const preview = previewCallCsv(csv, await loadImportContext(await serviceDb(), new Date()));
  return { csv, preview };
}

/** /admin/calls/import, step 2: check again, then save every ready row. Duplicates are skipped. */
export async function saveImportAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const actor = await requireStaff("admin", "/admin/calls/import");
  const csv = String(fd.get("csv") ?? "");
  const db = await serviceDb();
  const preview = previewCallCsv(csv, await loadImportContext(db, new Date()));
  if (!preview.canSave) return { csv, preview, error: "Nothing saved: fix the rows marked below, then preview again." };
  let saved = 0;
  for (const row of preview.rows) {
    if (row.status !== "ok" || !row.payload) continue;
    const result = await recordCall({ db, actor, payload: row.payload, enteredVia: "csv" });
    if (!result.ok) {
      revalidatePath("/", "layout");
      return { csv, preview, saved, error: `Saved ${saved}, then stopped at line ${row.line}: ${result.message} Preview again to continue; saved rows are skipped.` };
    }
    saved++;
  }
  revalidatePath("/", "layout");
  return { saved, skipped: preview.rows.length - saved };
}
