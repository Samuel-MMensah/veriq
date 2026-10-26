import { expect, test, type Browser, type Page } from "@playwright/test";

/** Puts the demo data back (Prompt 8, /admin/demo), so each spec file starts from the demo story. */
export async function resetDemo(browser: Browser): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/admin/demo");
  await page.getByRole("button", { name: "Demo login" }).click();
  await page.getByRole("button", { name: "Reset demo data" }).click();
  // The first reset after the server starts can take a few seconds.
  await expect(page.getByRole("status")).toContainText("The demo story starts fresh.", { timeout: 15_000 });
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

/** The local admin made from VERIQ_LOCAL_ADMIN in playwright.config.ts (local data mode only). */
export const LOCAL_ADMIN = { email: "admin@veriq.test", password: "local-admin-pass" };

/** Signs in with email and password on whatever staff page is open (Prompt 10). */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signInAdmin(page: Page, path = "/admin"): Promise<void> {
  await page.goto(path);
  await signIn(page, LOCAL_ADMIN.email, LOCAL_ADMIN.password);
  await expect(page.getByRole("navigation", { name: "Admin" }).first()).toBeVisible();
}
