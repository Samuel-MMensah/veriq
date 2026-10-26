// Rule 8: reports are saved on the phone first and sent to /api/reports when there is a connection.
// A report leaves the queue once the server has counted, held or turned it away; it stays when the
// network or the server fails, and is sent again later.
import { localDb, type QueuedReport } from "./db";
import { getDeviceId } from "./device";

export type NewQueuedReport = Omit<QueuedReport, "key" | "queuedAt">;

export type SubmitOutcome =
  | { kind: "sent"; status: "counted" | "held"; reportId: string }
  | { kind: "already"; message: string }
  | { kind: "rejected"; message: string }
  | { kind: "queued" };

type Options = { fetchImpl?: typeof fetch; online?: boolean };

const SENT_KEY = "sentCount";
let counter = 0;

async function enqueue(report: NewQueuedReport): Promise<QueuedReport> {
  const now = new Date();
  const queued: QueuedReport = {
    ...report,
    key: `${String(now.getTime()).padStart(15, "0")}-${String(counter++).padStart(6, "0")}`,
    queuedAt: now.toISOString(),
  };
  await (await localDb()).put("queue", queued);
  return queued;
}

export async function queuedReports(): Promise<QueuedReport[]> {
  return (await localDb()).getAll("queue");
}

async function addSent(): Promise<void> {
  const db = await localDb();
  const sent = Number((await db.get("meta", SENT_KEY)) ?? 0);
  await db.put("meta", sent + 1, SENT_KEY);
}

/** Reports this phone has sent, and reports waiting to send (screen 11). */
export async function myReportCounts(): Promise<{ sent: number; waiting: number }> {
  const db = await localDb();
  return { sent: Number((await db.get("meta", SENT_KEY)) ?? 0), waiting: await db.count("queue") };
}

type Attempt = SubmitOutcome | { kind: "retry" };

/** One try. Only the report fields and the random device id are sent (rule 2). */
async function attempt(q: QueuedReport, fetchImpl: typeof fetch): Promise<Attempt> {
  const body = {
    deviceId: await getDeviceId(),
    facilityId: q.facilityId,
    insurerId: q.insurerId,
    outcome: q.outcome,
    amountGhs: q.amountGhs,
    item: q.item,
    serviceId: q.serviceId,
  };
  let res: Response;
  try {
    res = await fetchImpl("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "retry" }; // offline or the network dropped
  }
  const data = (await res.json().catch(() => ({}))) as { status?: string; reportId?: string; message?: string };
  if ((data.status === "counted" || data.status === "held") && data.reportId) {
    return { kind: "sent", status: data.status, reportId: data.reportId };
  }
  if (data.status === "already_counted") return { kind: "already", message: data.message ?? "Already counted." };
  if (data.status === "invalid") return { kind: "rejected", message: data.message ?? "The report was not accepted." };
  // Rule R1: reports on this hospital are closed, so the queued report is dropped, not retried.
  if (data.status === "closed") return { kind: "rejected", message: data.message ?? "Reporting opens soon." };
  return { kind: "retry" }; // server problem: keep it for later
}

async function settle(q: QueuedReport, result: Attempt): Promise<void> {
  if (result.kind === "retry") return;
  await (await localDb()).delete("queue", q.key);
  if (result.kind === "sent") await addSent();
}

/** Save the report on the phone, then try to send it now. */
export async function submitOrQueue(report: NewQueuedReport, opts: Options = {}): Promise<SubmitOutcome> {
  const queued = await enqueue(report);
  const online = opts.online ?? (typeof navigator === "undefined" || navigator.onLine);
  if (!online) return { kind: "queued" };
  const result = await attempt(queued, opts.fetchImpl ?? fetch);
  await settle(queued, result);
  return result.kind === "retry" ? { kind: "queued" } : result;
}

let flushing: Promise<{ sent: number; remaining: number }> | null = null;

/** Send every waiting report, oldest first. Stops at the first failure to try again later. */
export function flushQueue(opts: Options = {}): Promise<{ sent: number; remaining: number }> {
  flushing ??= (async () => {
    let sent = 0;
    try {
      for (const q of await queuedReports()) {
        const result = await attempt(q, opts.fetchImpl ?? fetch);
        await settle(q, result);
        if (result.kind === "retry") break;
        if (result.kind === "sent") sent++;
      }
    } finally {
      flushing = null;
    }
    return { sent, remaining: (await queuedReports()).length };
  })();
  return flushing;
}
