import { expect, test } from "@playwright/test";
import { resetDemo } from "./helpers";

// UX audit fixes (session 2026-10-24-04): emergency reachable from first open, call buttons in
// emergency mode, no dead ends on empty results or the Saved tab, the card's answer first.

test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

test("first open has a one-tap way into emergency mode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Emergency" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Get help now. Cards come later.");
});

test("a returning visitor goes straight to Find, with no welcome flash", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/find$/);
  const res = await page.request.get("/", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toBe("/find");
});

test("emergency mode: every unit can be called and reached; the card still hides nothing (rules 3, S2)", async ({ page }) => {
  await page.goto("/emergency");
  await expect(page.getByRole("link", { name: "Call Akoma Mission Hospital" })).toHaveAttribute("href", /^tel:\+233/);
  await expect(page.getByRole("link", { name: "Go: directions to Pinecrest Specialist Hospital" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3);
});

test("no results offers a wider search and every hospital nearby, not a dead end", async ({ page }) => {
  await page.goto("/results?service=dental&card=prudential&lat=5.69&lng=-0.03&area=ashaiman&r=2");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("0 hospitals near Ashaiman");
  await expect(page.getByRole("list", { name: "What the badges mean" })).toHaveCount(0);
  await page.getByRole("link", { name: "Search within 5 km" }).click();
  await expect(page.getByText("Dental · Prudential · within 5 km")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("near Ashaiman");
});

test("the hospital page answers the searched card once, first, and report tables open on tap", async ({ page }) => {
  await page.goto("/facility/f0000000-0000-4000-8000-000000000001?card=nhis");
  // Shown once, in its own section above "Today"; the other cards keep their badge and source (rule 4).
  const yours = page.getByRole("region", { name: "Your card here" });
  await expect(yours).toContainText("Takes NHIS");
  await expect(yours).toContainText("Confirmed by hospital 2 days ago");
  const others = page.getByRole("region", { name: "Other cards" });
  await expect(others).not.toContainText("NHIS ");
  await expect(others).toContainText("On insurer list, not checked yet. Call first");
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByText("Patients, last 30 days: 9 card worked", { exact: false }).click();
  await expect(page.getByRole("table")).toHaveCount(1);
});

test("Saved offers the last search again (rule 8)", async ({ page }) => {
  await page.goto("/find");
  await page.getByText("Scan / X-ray").click();
  await page.getByRole("button", { name: "Show hospitals that take NHIS" }).click();
  await expect(page).toHaveURL(/\/results/);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Saved" }).click();
  await page.getByRole("link", { name: /Scan \/ X-ray · NHIS · near Dansoman/ }).click();
  await expect(page.getByText("Scan / X-ray · NHIS · within 5 km")).toBeVisible();
});

test("results stay short: legend folded, no 'nothing reported' lines, never-updated services folded", async ({ page }) => {
  await page.goto("/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman");
  await expect(page.getByText("No top-up reported")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "What the badges mean" })).toBeHidden();
  await page.getByText("What the colours mean").click();
  await expect(page.getByRole("list", { name: "What the badges mean" })).toBeVisible();
  await page.goto("/facility/f0000000-0000-4000-8000-000000000001?card=nhis");
  await expect(page.getByText("C-section", { exact: false })).toBeHidden();
  await page.getByText("more services", { exact: false }).click();
  await expect(page.getByText("C-section", { exact: false })).toBeVisible();
});
