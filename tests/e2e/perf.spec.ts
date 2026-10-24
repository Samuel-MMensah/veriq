import { expect, test } from "@playwright/test";

// Phase 1 gate: first content in under 3 seconds on throttled 3G (SPEC sections 6 and 9).
// Chrome's "Regular 3G" profile (750 kb/s down, 250 kb/s up, 100 ms latency) with the CPU slowed
// 4x, like a cheap Android phone (rule 7). Each page loads in a fresh browser: no cache.
// Point it at the deployed site with E2E_BASE_URL=https://… npm run e2e -- perf

const AKOMA = "f0000000-0000-4000-8000-000000000001";
const PAGES = [
  "/",
  "/find",
  "/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman",
  `/facility/${AKOMA}?lat=5.545&lng=-0.265&card=nhis`,
  "/emergency",
];
export const BUDGET_MS = 3000;

// Warm the server once (as a live site is), so a cold start of the local test server isn't counted.
test.beforeAll(async ({ request }) => {
  for (const path of PAGES) await request.get(path);
});

for (const path of PAGES) {
  test(`first content under 3 s on 3G: ${path}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 100,
      downloadThroughput: (750 * 1024) / 8,
      uploadThroughput: (250 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    await page.goto(path, { waitUntil: "load", timeout: 30_000 });
    const fcp = await page.evaluate(
      () => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? Number.POSITIVE_INFINITY,
    );
    test.info().annotations.push({ type: "first-contentful-paint", description: `${Math.round(fcp)} ms` });
    console.log(`FCP ${path}: ${Math.round(fcp)} ms`);
    expect(fcp).toBeLessThan(BUDGET_MS);
    await context.close();
  });
}
