// @vitest-environment node
// POST /api/reports in local data mode (in-memory seed).
import { beforeAll, describe, expect, it, vi } from "vitest";

const AKOMA = "f0000000-0000-4000-8000-000000000001";
const NHIS = "a0000000-0000-4000-8000-000000000001";

let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubEnv("VERIQ_DATA", "local");
  vi.stubEnv("REPORT_HASH_SECRET", "route-test-secret");
  ({ POST } = await import("./route"));
}, 60_000);

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/reports", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/reports (rule A)", () => {
  it("counts a first report (201), then refuses a repeat politely (409)", async () => {
    const report = { deviceId: "route-test-phone-1", facilityId: AKOMA, insurerId: NHIS, outcome: "topup", amountGhs: 80, item: "scan" };
    const first = await post(report);
    expect(first.status).toBe(201);
    const body = await first.json();
    expect(body).toMatchObject({ status: "counted" });
    expect(body.reportId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.headers.get("cache-control")).toBe("no-store");

    const again = await post(report);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ status: "already_counted", message: expect.stringMatching(/already counted/i) });
  }, 60_000);

  it("refuses a report with a name in it (rule 2)", async () => {
    const res = await post({ deviceId: "route-test-phone-2", facilityId: AKOMA, insurerId: NHIS, outcome: "covered", name: "Ama" });
    expect(res.status).toBe(400);
  });

  it("refuses broken JSON and oversized bodies", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post("x".repeat(3000))).status).toBe(413);
  });

  it("pauses reports when the secret is missing outside local mode", async () => {
    vi.stubEnv("VERIQ_DATA", "");
    vi.stubEnv("REPORT_HASH_SECRET", "");
    const res = await post({ deviceId: "route-test-phone-3", facilityId: AKOMA, insurerId: NHIS, outcome: "covered" });
    expect(res.status).toBe(503);
    vi.stubEnv("VERIQ_DATA", "local");
    vi.stubEnv("REPORT_HASH_SECRET", "route-test-secret");
  });
});
