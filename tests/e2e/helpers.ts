import { expect, test, type Browser } from "@playwright/test";

/** Puts the demo data back (Prompt 8, /admin/demo), so each spec file starts from the demo story. */
export async function resetDemo(browser: Browser): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/admin/demo");
  await page.getByRole("button", { name: "Demo login" }).click();
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(page.getByRole("status")).toContainText("The demo story starts fresh.");
  await context.close();
}

/**
 * Rule D2: the demo hospitals show only in demo mode. Specs that tell the demo story turn it on for
 * every test, with the same cookie ?demo=1 sets (proxy.ts).
 */
export function demoModeInEveryTest(): void {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "veriq_demo", value: "1", url: baseURL! }]);
  });
}
