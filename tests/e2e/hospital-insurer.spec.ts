import { expect, test } from "@playwright/test";
import { demoModeInEveryTest, resetDemo } from "./helpers";

demoModeInEveryTest();

// Prompt 7: screen 16 (morning check, rule M) and screen 18 (insurer network health, rule K).
// Runs after find-results.spec.ts (files run in order), because it closes Akoma's antenatal clinic.

// Start from the demo story, whatever ran before (Prompt 8 reset).
test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

const RESULTS = "/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman";

test("the hospital marks antenatal Closed, and the results page shows it (demo step 6)", async ({ page }) => {
  await page.goto(RESULTS);
  const akoma = page.getByRole("link", { name: /Akoma Mission Hospital/ });
  await expect(akoma).toContainText(/Antenatal clinic: Open till \d{1,2}(:\d{2})? (am|pm)/); // rule F: until_time

  await page.goto("/h/check");
  await expect(page.getByText("Rehearsal only")).toBeVisible();
  await page.getByRole("button", { name: "Demo login" }).click();
  await expect(page.getByText("Front desk · Esi")).toBeVisible();
  await expect(page.getByText("Akoma Mission Hospital · about 30 seconds")).toBeVisible();
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toBeVisible();
  await expect(page.getByText("3 patients said", { exact: false })).toBeVisible();
  await expect(page.getByText("214 people found you on Veriq last week")).toBeVisible();

  const antenatal = page.getByRole("group", { name: "Antenatal clinic" });
  await expect(antenatal.getByLabel("Open")).toBeChecked();
  await antenatal.getByText("Closed").click();
  await page.getByRole("button", { name: "Confirm and publish" }).click();
  await expect(page.getByRole("status")).toContainText("Patients see it now. (4 services confirmed");

  await page.goto(RESULTS);
  await expect(akoma).toContainText("Antenatal clinic: Closed · updated by hospital just now");
  // Still first: it is the only hospital-confirmed one (rule S1 sorts by badge first).
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Akoma Mission Hospital");
});

test("the insurer sees rule K figures: 23 refusals at 6 hospitals, Pinecrest first (demo step 8)", async ({ page }) => {
  await page.goto("/i/network");
  await page.getByRole("button", { name: "Demo login" }).click();
  await expect(page.getByText("Network team · Kojo")).toBeVisible();
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toBeVisible();

  const refused = page.getByRole("listitem").filter({ hasText: "Members refused" });
  await expect(refused).toContainText("23");
  await expect(refused).toContainText("at 6 hospitals");

  const rows = page.getByRole("table").getByRole("row");
  await expect(rows.nth(1)).toContainText("Pinecrest Specialist Hospital");
  await expect(rows.nth(1)).toContainText("In network");
  await expect(rows.nth(1)).toContainText("9");
  await expect(page.getByRole("row", { name: /Akoma Mission Hospital/ })).toContainText("Not listed");
  await expect(page.getByText("Coverage gaps")).toBeVisible();
});

test("staff views need the demo login, and signing out ends it", async ({ page }) => {
  await page.goto("/i/network");
  await expect(page.getByRole("button", { name: "Demo login" })).toBeVisible();
  await expect(page.getByText("Members refused")).toHaveCount(0);

  await page.getByRole("button", { name: "Demo login" }).click();
  await expect(page.getByText("Members refused")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Demo login" })).toBeVisible();
  await page.goto("/i/network");
  await expect(page.getByRole("button", { name: "Demo login" })).toBeVisible();

  // The hospital account can't open the insurer view.
  await page.goto("/h/check");
  await page.getByRole("button", { name: "Demo login" }).click();
  await expect(page.getByText("Front desk · Esi")).toBeVisible();
  await page.goto("/i/network");
  await expect(page.getByRole("button", { name: "Demo login" })).toBeVisible();
  await expect(page.getByText("Members refused")).toHaveCount(0);
});

test("the insurer view fits a 390 px phone without sideways scrolling (rule 7)", async ({ page }) => {
  await page.goto("/i/network");
  await page.getByRole("button", { name: "Demo login" }).click();
  await expect(page.getByText("Network team · Kojo")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
