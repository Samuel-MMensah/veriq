import { expect, test, type Page } from "@playwright/test";
import { demoModeInEveryTest, resetDemo } from "./helpers";

demoModeInEveryTest();

// Prompt 5: the report loop (demo step 5). Local data mode: a fresh seed on every server start, and
// each test gets a fresh browser, so a fresh phone (device id) too.

// Start from the demo story, whatever ran before (Prompt 8 reset).
test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

const AKOMA = "f0000000-0000-4000-8000-000000000001";
const LAKESIDE = "f0000000-0000-4000-8000-000000000002";

async function openReport(page: Page, facilityId: string) {
  await page.goto(`/facility/${facilityId}?lat=5.545&lng=-0.265&card=nhis`);
  await page.getByRole("link", { name: "Been here? Tell others if your card worked" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Was your NHIS card accepted?");
}

test("Akoma: 'Yes, but I paid extra' GH¢ 80 for a scan; thanks shows what changed", async ({ page }) => {
  await openReport(page, AKOMA);
  await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
  await expect(page.getByText("Anonymous. We never ask for your name or card number.")).toBeVisible();

  await page.getByText("Yes, but I paid extra").click();
  await page.getByLabel("Amount in Ghana cedis").fill("80");
  await page.getByText("Scan", { exact: true }).click();
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you. The next person will know.");
  await expect(page.getByText("What changed")).toBeVisible();
  await expect(page.getByText("Scan top-up about GH¢ 80 (4 patients, last 60 days)")).toBeVisible();
  await expect(page.getByText("Before your report: Scan top-up about GH¢ 80 (3 patients, last 60 days).")).toBeVisible();
  await expect(page.getByText("report from you")).toBeVisible();
  await expect(page.getByText("we ask the hospital to confirm or correct it at its morning check", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "Done" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Akoma Mission Hospital");
  await expect(page.getByText("Scan top-up about GH¢ 80 (4 patients, last 60 days)")).toBeVisible();
});

test("a second report from the same phone within 7 days is refused politely (rule A)", async ({ page }) => {
  await openReport(page, LAKESIDE);
  await page.getByText("Yes, fully covered").click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you. The next person will know.");

  await openReport(page, LAKESIDE);
  await page.getByText("No, they refused my card").click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("status")).toContainText("already counted");
  await expect(page.getByRole("link", { name: "Back to the hospital" })).toBeVisible();
});

test("offline: the report waits on the phone, then sends when back online (rule 8)", async ({ page, context }) => {
  test.setTimeout(90_000); // slow runs: sending the queue can take a while
  await openReport(page, LAKESIDE);
  await context.setOffline(true);
  // "Covered", so this test doesn't change the refusal figures other tests read.
  await page.getByText("Yes, fully covered").click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saved on your phone.");

  await context.setOffline(false);
  // Back online: the app sends the queue (on the "online" event, and whenever a page opens).
  await page.goto("/report/thanks");
  await expect(page.getByText("waiting to send")).toBeVisible();
  // The counts are read when the page loads, and every page load sends the queue again (as a phone
  // that comes back online would). Reload until the report shows as sent; allow 30 s on slow runs.
  await expect
    .poll(
      async () => {
        await page.reload();
        return page.getByText("report from you").isVisible();
      },
      { timeout: 30_000, intervals: [1_000, 2_000, 3_000] },
    )
    .toBe(true);
  await page.reload();
  await expect(page.locator("p", { hasText: "report from you" }).locator("xpath=preceding-sibling::p")).toHaveText("1");
  await expect(page.locator("p", { hasText: "waiting to send" }).locator("xpath=preceding-sibling::p")).toHaveText("0");
});
