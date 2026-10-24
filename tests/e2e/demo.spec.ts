import { expect, test } from "@playwright/test";
import { resetDemo } from "./helpers";

// SPEC section 9: the 90-second demo, step by step. This is the Phase 1 acceptance test.
// It starts from "Reset demo data" (Prompt 8), on a phone-sized screen with a fresh phone.

test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

test("the 90-second demo (SPEC section 9)", async ({ page }) => {
  // 1. Open the app on a phone and tap through the first-open screen.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Know before you go.");
  await page.getByRole("link", { name: "Get started" }).click();

  // 2. Choose Antenatal / maternity and NHIS, near Dansoman. Tap "Show hospitals that take NHIS".
  await page.getByText("Antenatal / maternity").click();
  await page.getByText("NHIS", { exact: true }).click();
  await expect(page.getByText("Near Dansoman, Accra")).toBeVisible();
  await page.getByRole("button", { name: "Show hospitals that take NHIS" }).click();

  // 3. Akoma (hospital confirmed), Lakeside (patients confirmed), Gbawe (not checked), Pinecrest last (refused).
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("4 hospitals near Dansoman");
  const cards = page.getByRole("list").filter({ has: page.getByRole("heading", { level: 2 }) }).getByRole("listitem");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText("Akoma Mission Hospital");
  await expect(cards.nth(0)).toContainText("Takes NHIS");
  await expect(cards.nth(0)).toContainText("Confirmed by hospital 2 days ago");
  await expect(cards.nth(1)).toContainText("Lakeside Family Clinic");
  await expect(cards.nth(1)).toContainText("patients confirmed in the last 30 days");
  await expect(cards.nth(2)).toContainText("Gbawe Community Clinic");
  await expect(cards.nth(2)).toContainText("NHIS not confirmed yet");
  await expect(cards.nth(2)).toContainText("On NHIA list, not checked yet. Call first");
  await expect(cards.nth(3)).toContainText("Pinecrest Specialist Hospital");
  await expect(cards.nth(3)).toContainText("Patients report NHIS refusals");
  await expect(cards.nth(3)).toContainText("Listed, but 9 patients were refused in the last 30 days");

  // 4. Open Akoma: today's status with times, cards with sources, the GH¢ 80 scan top-up.
  await cards.nth(0).getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Akoma Mission Hospital");
  await expect(page.getByText(/^Updated by hospital \d{1,2}:\d{2} (am|pm)$/)).toBeVisible();
  await expect(page.getByText("Open till 4 pm")).toBeVisible();
  await expect(page.getByText("Accepting")).toBeVisible();
  await expect(page.getByText("Confirmed by hospital 2 days ago").first()).toBeVisible();
  await expect(page.getByText("On insurer list, not checked yet. Call first")).toBeVisible();
  await expect(page.getByText("Scan top-up about GH¢ 80 (3 patients, last 60 days)")).toBeVisible();

  // 5. Tap "Been here?", choose "Yes, but I paid extra", then Send. The thank-you screen shows what changed.
  await page.getByRole("link", { name: "Been here? Tell others if your card worked" }).click();
  await page.getByText("Yes, but I paid extra").click();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you. The next person will know.");
  await expect(page.getByText("What changed")).toBeVisible();
  await expect(page.getByText("Akoma Mission Hospital still shows:", { exact: false })).toBeVisible();

  // 6. Switch to the hospital demo login: mark the antenatal clinic Closed and publish.
  //    Back on Results, Akoma now shows Closed.
  await page.goto("/h/check");
  await page.getByRole("button", { name: "Demo login" }).click();
  await page.getByRole("group", { name: "Antenatal clinic" }).getByText("Closed").click();
  await page.getByRole("button", { name: "Confirm and publish" }).click();
  await expect(page.getByRole("status")).toContainText("Patients see it now.");
  await page.goto("/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman&r=5");
  await expect(page.getByRole("link", { name: /Akoma Mission Hospital/ })).toContainText("Antenatal clinic: Closed");

  // 7. Open emergency mode: 112 and 193, units sorted by status and distance, the card shown but not filtering.
  await page.goto("/find");
  await page.getByRole("link", { name: /Emergency\?/ }).click();
  await expect(page.getByRole("link", { name: /112/ })).toHaveAttribute("href", "tel:112");
  await expect(page.getByRole("link", { name: /193/ })).toHaveAttribute("href", "tel:193");
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Akoma Mission Hospital",
    "Westhills District Hospital",
    "Pinecrest Specialist Hospital",
  ]);
  await expect(page.getByText("Takes your NHIS card").first()).toBeVisible();
  await expect(page.getByText("NHIS reported refused")).toBeVisible(); // Pinecrest is shown, not hidden

  // 8. Finish on the insurer view: "Members were refused 23 times at 6 hospitals this month."
  await page.goto("/i/network");
  await page.getByRole("button", { name: "Demo login" }).click();
  const refused = page.getByRole("listitem").filter({ hasText: "Members refused" });
  await expect(refused).toContainText("23");
  await expect(refused).toContainText("at 6 hospitals");
});
