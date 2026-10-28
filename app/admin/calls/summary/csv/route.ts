// Prompt 10b, item 4: the call summary as CSV, the same numbers as /admin/calls/summary. Admins only.
import { currentStaff } from "@/lib/auth/session";
import { loadCallSummary } from "@/lib/calls/record";
import { summaryCsv } from "@/lib/calls/summary";
import { listInsurers } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await currentStaff();
  if (staff?.role !== "admin" || staff.mustChangePassword) return new Response("Admins only.", { status: 403 });
  const db = await serviceDb();
  const csv = summaryCsv(await loadCallSummary(db, await listInsurers(db)));
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="veriq-call-summary-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
