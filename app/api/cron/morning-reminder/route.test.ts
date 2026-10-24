// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: (req: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubEnv("VERIQ_DATA", "local");
  vi.stubEnv("CRON_SECRET", "cron-test-secret");
  ({ GET } = await import("./route"));
}, 60_000);

const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/morning-reminder", { headers: auth ? { authorization: auth } : {} }));

describe("GET /api/cron/morning-reminder (rule M)", () => {
  it("refuses calls without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
  });

  it("runs with the cron secret", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await call("Bearer cron-test-secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Sent after 07:30 Ghana time, skipped before; either way the stub never prints a full number.
    expect(body.sent + (body.skipped ? 1 : 0)).toBeGreaterThanOrEqual(1);
    expect(log.mock.calls.map((c) => String(c[0])).join("\n")).not.toContain("233000000101");
    log.mockRestore();
  }, 60_000);
});
