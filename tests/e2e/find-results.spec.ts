import { expect, test } from "@playwright/test";
import { demoModeInEveryTest, resetDemo } from "./helpers";

demoModeInEveryTest();

// Prompt 4: find antenatal with NHIS, see 4 results in the right order, open Akoma (demo steps 1 to 4).
// The server runs with VERIQ_DATA=local, so the seed is fresh on every start.

// Start from the demo story, whatever ran before (Prompt 8 reset).
test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

test("first open, find antenatal with NHIS, 4 results in order, open Akoma", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Know before you go.");
  await page.getByRole("link", { name: "Get started" }).click();

  await expect(page).toHaveURL(/\/find$/);
  await expect(page.getByLabel("Antenatal / maternity")).toBeChecked();
  await expect(page.getByLabel(/^NHIS/)).toBeChecked();
  await expect(page.getByText("Near Dansoman, Accra")).toBeVisible();
  await page.getByRole("button", { name: "Show hospitals that take NHIS" }).click();

  await expect(page).toHaveURL(/\/results\?/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("4 hospitals near Dansoman");
  await expect(page.getByText("SAMPLE DATA")).toBeVisible();
  const names = page.getByRole("list").filter({ has: page.getByRole("heading", { level: 2 }) }).getByRole("heading", { level: 2 });
  await expect(names).toHaveText([
    "Akoma Mission Hospital",
    "Lakeside Family Clinic",
    "Gbawe Community Clinic",
    "Pinecrest Specialist Hospital",
  ]);
  // Rule B wording, with the card it is about. Counts can grow when report tests run in parallel
  // against the same server, so they are matched as numbers.
  // Rule B as an answer first ("Takes NHIS"), then the rule's own words saying who said so and when.
  const cards = page.getByRole("list").filter({ has: page.getByRole("heading", { level: 2 }) }).getByRole("listitem");
  await expect(cards.nth(0)).toContainText("Takes NHISConfirmed by hospital 2 days ago");
  await expect(cards.nth(1).getByText(/^1\d patients confirmed in the last 30 days$/)).toBeVisible();
  await expect(cards.nth(1)).toContainText("Takes NHIS");
  await expect(cards.nth(2)).toContainText("NHIS not confirmed yetOn NHIA list, not checked yet. Call first");
  await expect(cards.nth(3)).toContainText("Patients report NHIS refusalsListed, but 9 patients were refused in the last 30 days");

  await page.getByRole("link", { name: /Akoma Mission Hospital/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Akoma Mission Hospital");
  await expect(page.getByText("Mission · Kaneshie · 1.8 km")).toBeVisible();
  await expect(page.getByRole("link", { name: "Call" })).toHaveAttribute("href", /^tel:/);
  await expect(page.getByRole("link", { name: "Directions" })).toHaveAttribute("href", /google\.com\/maps\/dir/);
  await expect(page.getByText(/^Updated by hospital \d{1,2}:\d{2} (am|pm)$/)).toBeVisible();
  await expect(page.getByText(/^Open(?: till \d{1,2}(?::\d{2})? (?:am|pm))?$/).first()).toBeVisible(); // rule F: the demo till time, if any
  await expect(page.getByText("From 2 pm")).toBeVisible();
  await expect(page.getByText(/^Scan top-up about GH¢ 80 \(\d patients, last 60 days\)$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Been here? Tell others if your card worked" })).toBeVisible();
});

test("first open shows once; after that / goes to Find care", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/find$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/find$/);
});

test("the button names the chosen card", async ({ page }) => {
  await page.goto("/find");
  await page.getByText("Cosmopolitan Health").click();
  await expect(page.getByRole("button", { name: "Show hospitals that take Cosmopolitan Health" })).toBeVisible();
  await page.getByText("No card / cash").click();
  await expect(page.getByRole("button", { name: "Show hospitals near you" })).toBeVisible();
});

test("No card/cash shows every antenatal facility nearby, without badges", async ({ page }) => {
  await page.goto("/results?service=antenatal&card=cash&lat=5.545&lng=-0.265&area=dansoman");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("6 hospitals near Dansoman");
  await expect(page.getByText(/Confirmed by hospital/)).toHaveCount(0);
});

test("results link to How Veriq checks", async ({ page }) => {
  await page.goto("/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman");
  await page.getByRole("link", { name: "How Veriq checks" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every badge tells you who said so, and when.");
  await expect(page.getByText("Hospitals can't pay to change a badge.", { exact: false })).toBeVisible();
});

test("a broken results link explains itself", async ({ page }) => {
  await page.goto("/results?card=nhis");
  await expect(page.getByText("We couldn't read this search")).toBeVisible();
});

test("Scan / X-ray searches ultrasound, X-ray and CT, and names the service shown", async ({ page }) => {
  await page.goto("/find");
  await page.getByText("Scan / X-ray").click();
  await page.getByText("No card / cash").click();
  await page.getByRole("button", { name: "Show hospitals near you" }).click();
  await expect(page).toHaveURL(/service=scan/);
  await expect(page.getByText("Scan / X-ray · No card / cash · within 5 km")).toBeVisible();
  await expect(page.getByRole("link", { name: /Unity Diagnostic Centre/ })).toContainText("Ultrasound scan: Available");
  await expect(page.getByRole("link", { name: /Westhills District Hospital/ })).toContainText("X-ray:");
});

test("a private card tells the whole story too: Cosmopolitan Health near Dansoman (2026-10-27)", async ({ page }) => {
  await page.goto("/find");
  await page.getByText("Antenatal / maternity").click();
  await page.getByText("Cosmopolitan Health", { exact: true }).click();
  await page.getByRole("button", { name: "Show hospitals that take Cosmopolitan Health" }).click();
  await expect(page).toHaveURL(/card=cosmopolitan/);

  const cards = page.getByRole("list").filter({ has: page.getByRole("heading", { level: 2 }) }).getByRole("listitem");
  const card = (name: string) => cards.filter({ hasText: name });
  // Hospital confirmed (B2), patients confirmed (B3), on the insurer's list (B4), refusals (B1).
  await expect(card("Akoma Mission Hospital")).toContainText("Takes Cosmopolitan Health");
  await expect(card("Akoma Mission Hospital")).toContainText(/Confirmed by hospital \d+ days? ago/);
  await expect(card("Lakeside Family Clinic")).toContainText("Takes Cosmopolitan Health");
  await expect(card("Lakeside Family Clinic")).toContainText("5 patients confirmed in the last 30 days");
  await expect(card("Gbawe Community Clinic")).toContainText("Cosmopolitan Health not confirmed yet");
  await expect(card("Gbawe Community Clinic")).toContainText("On insurer list, not checked yet. Call first");
  await expect(card("Glefe Seaside Clinic")).toContainText("Patients report Cosmopolitan Health refusals");
  await expect(card("Glefe Seaside Clinic")).toContainText("Listed, but 4 patients were refused in the last 30 days");
  // Rule S1: refusals come last.
  await expect(cards.last()).toContainText("Glefe Seaside Clinic");
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toBeVisible();
});
