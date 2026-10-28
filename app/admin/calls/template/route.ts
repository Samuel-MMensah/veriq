// Prompt 10b, item 5: the blank CSV template for paper calls, with one pair of columns per card in
// real insurer, never a demo one (the same file as docs/calls/calls-template.csv). Admins only.
import { currentStaff } from "@/lib/auth/session";
import { callCards } from "@/lib/calls/context";
import { callCsvHeader } from "@/lib/calls/csv";
import { listInsurers } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await currentStaff();
  if (staff?.role !== "admin" || staff.mustChangePassword) return new Response("Admins only.", { status: 403 });
  const cards = callCards(await listInsurers(await serviceDb()));
  return new Response(`${callCsvHeader(cards.map((c) => c.slug)).join(",")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="veriq-calls-template.csv"',
      "cache-control": "no-store",
    },
  });
}
