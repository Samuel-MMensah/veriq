import { expect, type Browser } from "@playwright/test";

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
