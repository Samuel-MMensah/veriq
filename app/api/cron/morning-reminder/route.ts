// GET /api/cron/morning-reminder: called by Vercel Cron at 07:30 Ghana time (vercel.json).
// Vercel sends "Authorization: Bearer $CRON_SECRET"; anything else is refused.
import { isLocalData, serviceDb } from "@/lib/db/server";
import { getMessenger } from "@/lib/messaging";
import { sendMorningReminders } from "@/lib/staff/reminders";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && !isLocalData()) return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }
  try {
    const result = await sendMorningReminders({
      db: await serviceDb(),
      messenger: getMessenger(),
      now: new Date(),
      checkUrl: new URL("/h/check", request.url).toString(),
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Morning reminder failed:", (e as Error).message);
    return Response.json({ error: "Reminder failed." }, { status: 500 });
  }
}
