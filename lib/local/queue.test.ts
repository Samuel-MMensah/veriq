// Rule 8: reports queue on the phone (IndexedDB) and send when back online.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetLocalDbForTests } from "./db";
import { getDeviceId } from "./device";
import { flushQueue, myReportCounts, queuedReports, submitOrQueue, type NewQueuedReport } from "./queue";

const report: NewQueuedReport = {
  facilityId: "f0000000-0000-4000-8000-000000000001",
  insurerId: "a0000000-0000-4000-8000-000000000001",
  outcome: "topup",
  amountGhs: 80,
  item: "scan",
  serviceId: null,
};

function server(...responses: (Record<string, unknown> | "offline")[]) {
  const calls: unknown[] = [];
  const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    const next = responses.shift() ?? { status: "counted", reportId: "r" };
    if (next === "offline") throw new TypeError("Failed to fetch");
    const status = next.status === "already_counted" ? 409 : next.status === "invalid" ? 400 : next.status === "error" ? 500 : 201;
    return new Response(JSON.stringify(next), { status });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

beforeEach(async () => {
  await resetLocalDbForTests();
});

describe("device id (rule A)", () => {
  it("is random, kept on the phone, and the same every time", async () => {
    const a = await getDeviceId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(await getDeviceId()).toBe(a);
  });
});

describe("submitOrQueue", () => {
  it("sends when online, counts it, and leaves nothing queued", async () => {
    const { fetchImpl, calls } = server({ status: "counted", reportId: "rep-1" });
    const result = await submitOrQueue(report, { fetchImpl, online: true });
    expect(result).toEqual({ kind: "sent", status: "counted", reportId: "rep-1" });
    expect(calls[0]).toMatchObject({ ...report, deviceId: await getDeviceId() });
    expect(await queuedReports()).toEqual([]);
    expect(await myReportCounts()).toEqual({ sent: 1, waiting: 0 });
  });

  it("keeps the report on the phone when offline, without trying to send", async () => {
    const { fetchImpl } = server();
    expect(await submitOrQueue(report, { fetchImpl, online: false })).toEqual({ kind: "queued" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await myReportCounts()).toEqual({ sent: 0, waiting: 1 });
  });

  it("keeps it when the network fails mid-send", async () => {
    const { fetchImpl } = server("offline");
    expect(await submitOrQueue(report, { fetchImpl, online: true })).toEqual({ kind: "queued" });
    expect(await queuedReports()).toHaveLength(1);
  });

  it("passes on the polite 'already counted' message and drops the copy", async () => {
    const { fetchImpl } = server({ status: "already_counted", message: "Already counted." });
    expect(await submitOrQueue(report, { fetchImpl, online: true })).toEqual({ kind: "already", message: "Already counted." });
    expect(await queuedReports()).toEqual([]);
  });

  it("never sends a name or card number: only the report fields and the device id", async () => {
    const { fetchImpl, calls } = server();
    await submitOrQueue(report, { fetchImpl, online: true });
    expect(Object.keys(calls[0] as object).sort()).toEqual(
      ["amountGhs", "deviceId", "facilityId", "insurerId", "item", "outcome", "serviceId"].sort(),
    );
  });
});

describe("flushQueue (back online)", () => {
  it("sends everything waiting, oldest first", async () => {
    await submitOrQueue(report, { fetchImpl: server().fetchImpl, online: false });
    await submitOrQueue({ ...report, outcome: "refused", amountGhs: null, item: null }, { fetchImpl: server().fetchImpl, online: false });
    const { fetchImpl, calls } = server();
    expect(await flushQueue({ fetchImpl })).toEqual({ sent: 2, remaining: 0 });
    expect((calls as { outcome: string }[]).map((c) => c.outcome)).toEqual(["topup", "refused"]);
    expect(await myReportCounts()).toEqual({ sent: 2, waiting: 0 });
  });

  it("stops at the first network failure and keeps the rest", async () => {
    await submitOrQueue(report, { fetchImpl: server().fetchImpl, online: false });
    await submitOrQueue(report, { fetchImpl: server().fetchImpl, online: false });
    const { fetchImpl } = server({ status: "counted", reportId: "a" }, "offline");
    expect(await flushQueue({ fetchImpl })).toEqual({ sent: 1, remaining: 1 });
  });

  it("keeps reports when the server has a problem, and drops ones it rejects", async () => {
    await submitOrQueue(report, { fetchImpl: server().fetchImpl, online: false });
    await submitOrQueue(report, { fetchImpl: server().fetchImpl, online: false });
    const { fetchImpl } = server({ status: "invalid", message: "Unknown hospital." }, { status: "error" });
    expect(await flushQueue({ fetchImpl })).toEqual({ sent: 0, remaining: 1 });
  });
});
