// @vitest-environment node
// POST /api/ussd in local data mode, in the aggregator's form format.
import { beforeAll, describe, expect, it, vi } from "vitest";

let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubEnv("VERIQ_DATA", "local");
  vi.stubEnv("REPORT_HASH_SECRET", "ussd-route-secret");
  ({ POST } = await import("./route"));
}, 60_000);

const dial = (text: string) =>
  POST(
    new Request("http://localhost/api/ussd?demo=1", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ sessionId: "s1", serviceCode: "*000#", phoneNumber: "+233244000111", text }).toString(),
    }),
  );

describe("POST /api/ussd", () => {
  it("opens the menu as plain text", async () => {
    const res = await dial("");
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await res.text()).toMatch(/^CON VERIQ HEALTH\n1 Find hospital/);
  }, 60_000);

  it("finishes a search and sends the SMS through the console stub, with the number masked", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await dial("1*1*1*1");
    expect(await res.text()).toMatch(/^END We sent you an SMS/);
    const printed = log.mock.calls.map((c) => String(c[0])).join("\n");
    expect(printed).toContain("[SMS stub] to ***111");
    expect(printed).not.toContain("244000111");
    log.mockRestore();
  });

  it("ends politely on nonsense", async () => {
    expect(await (await dial("7*7")).text()).toBe("END Sorry, that isn't on the menu. Please dial again.");
  });
});
