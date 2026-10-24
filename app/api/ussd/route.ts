// POST /api/ussd: screen 13's menu for any phone. Phase 1 is tested but not connected to a short
// code; Phase 2 connects an aggregator (Prompt 14). The request follows the common Africa's Talking
// shape: form fields sessionId, serviceCode, phoneNumber and text ("1*1*2"). The reply is plain text
// starting "CON " or "END ". Rule 2: the phone number is never logged or stored.
import { isLocalData, readDb, serviceDb } from "@/lib/db/server";
import { getMessenger } from "@/lib/messaging";
import { handleUssd } from "@/lib/ussd/menu";

const LOCAL_ONLY_SECRET = "local-data-mode-only";

const reply = (text: string) =>
  new Response(text, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  let fields: URLSearchParams;
  try {
    fields = new URLSearchParams(await request.text());
  } catch {
    return reply("END Sorry, something went wrong. Please dial again.");
  }
  const text = (fields.get("text") ?? "").slice(0, 200);
  const phone = (fields.get("phoneNumber") ?? "").replace(/[^\d+]/g, "").slice(0, 20);

  const secret = process.env.REPORT_HASH_SECRET || (isLocalData() ? LOCAL_ONLY_SECRET : "");
  try {
    const answer = await handleUssd(
      { text, phone },
      { readDb: await readDb(), serviceDb: await serviceDb(), messenger: getMessenger(), secret, now: new Date() },
    );
    return reply(answer);
  } catch (e) {
    console.error("USSD failed:", (e as Error).message);
    return reply("END Sorry, something went wrong. Please dial again. Emergency? Call 112.");
  }
}
