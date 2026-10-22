// POST /api/reports: the only way a patient report gets in (rule A, SPEC section 3).
// Never logs the body or the caller's address (rule 2).
import { isLocalData, serviceDb } from "@/lib/db/server";
import { submitReport } from "@/lib/reports/submit";

const MAX_BODY_BYTES = 2_000;
const LOCAL_ONLY_SECRET = "local-data-mode-only";

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ status: "invalid", message: "The report is too long." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ status: "invalid", message: "The report could not be read." }, 400);
  }

  // Local data mode has throwaway sample data, so it may run without a configured secret.
  const secret = process.env.REPORT_HASH_SECRET || (isLocalData() ? LOCAL_ONLY_SECRET : "");
  if (!secret) {
    console.error("REPORT_HASH_SECRET is not set; reports are refused.");
    return json({ status: "error", message: "Reports are paused. Your report is kept on your phone." }, 503);
  }

  try {
    const result = await submitReport({ db: await serviceDb(), body, secret, now: new Date() });
    const status = { counted: 201, held: 201, already_counted: 409, invalid: 400 }[result.status];
    return json(result, status);
  } catch (e) {
    console.error("Report failed:", (e as Error).message);
    return json({ status: "error", message: "Something went wrong. Your report is kept on your phone." }, 500);
  }
}
