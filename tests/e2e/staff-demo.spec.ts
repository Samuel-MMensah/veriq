import { expect, test } from "@playwright/test";
import { resetDemo } from "./helpers";

// Prompt 10's staff checks with the demo login only, so they also run against the demo deployment
// (E2E_BASE_URL=<demo URL>). They touch demo hospitals only (rule D2): role checks, held-report
// review (rule A) and the morning check's till time (rule F). The checks with real accounts stay in
// staff.spec.ts, which runs locally only, because it makes accounts and verifies a real hospital.

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

test("role checks with demo accounts: hospital staff can't open admin pages, insurer staff can't verify", async ({ page }) => {
  await page.goto("/h/check");
  await page.getByRole("button", { name: "Demo login" }).click();
  await expect(page.getByRole("button", { name: "Confirm and publish" })).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByText("This page is for Veriq admins.")).toBeVisible();
  await expect(page.getByText("You are signed in as hospital staff.")).toBeVisible();
  await page.goto("/admin/hospitals");
  await expect(page.getByText("This page is for Veriq admins.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as verified" })).toHaveCount(0);

  await page.goto("/i/network");
  await page.getByRole("button", { name: "Demo login" }).click();
  // The sign-in page has the same title, so wait for a figure only the signed-in view shows.
  await expect(page.getByRole("listitem").filter({ hasText: "Members refused" })).toBeVisible();
  await page.goto("/admin/hospitals");
  await expect(page.getByText("This page is for Veriq admins.")).toBeVisible();
  await expect(page.getByText("You are signed in as insurer staff.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as verified" })).toHaveCount(0);
});

test("held reports (rule A) with the demo admin: release one and reject one, each with a reason, on a demo hospital", async ({ page, request }) => {
  // 13 reports on one demo hospital within the hour: the 11th and later are held.
  const facilityId = "f0000000-0000-4000-8000-000000000003"; // Gbawe (demo)
  const run = Date.now().toString(36);
  for (let i = 0; i < 13; i++) {
    const res = await request.post("/api/reports?demo=1", {
      data: { deviceId: `e2e-demo-burst-${run}-${i}`, facilityId, insurerId: "a0000000-0000-4000-8000-000000000001", outcome: "refused" },
    });
    expect(res.status()).toBe(201);
  }
  await page.goto("/admin/reports?demo=1");
  await page.getByRole("button", { name: "Demo login" }).click();
  // Wait until the demo login has signed in, then open the list in demo mode.
  await expect(page.getByRole("button", { name: "Demo login" })).toHaveCount(0);
  await page.goto("/admin/reports?demo=1");
  const held = page.locator("li").filter({ hasText: "held by the burst rule" }).filter({ hasText: "Gbawe Community Clinic" });
  await expect(held.first()).toBeVisible();
  const before = await held.count();
  expect(before).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("SAMPLE DATA", { exact: true }).first()).toBeVisible();

  await held.first().getByRole("button", { name: "Release" }).click();
  let dialog = page.getByRole("dialog").filter({ hasText: "Release this report?" });
  await dialog.getByLabel("Why?").fill("Rehearsal: busy clinic day");
  await dialog.getByRole("button", { name: "Release" }).click();
  await expect(page.getByRole("status")).toContainText("Released. The report counts from now on.");
  await expect(held).toHaveCount(before - 1);

  await held.first().getByRole("button", { name: "Reject" }).click();
  dialog = page.getByRole("dialog").filter({ hasText: "Reject this report?" });
  await dialog.getByLabel("Why?").fill("Rehearsal: same burst pattern");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByRole("status")).toContainText("Rejected. The report will never count.");
  await expect(held).toHaveCount(before - 2);
});

test("morning check (rule F): the demo hospital sets 'open till' a time, and patients see it", async ({ page }) => {
  // The till time must be later today: two hours ahead, or the last minute of the day near midnight.
  const accraNow = new Date();
  const later = new Date(accraNow.getTime() + 2 * 60 * 60 * 1000);
  const sameDay = later.getUTCDate() === accraNow.getUTCDate();
  test.skip(accraNow.getUTCHours() === 23 && accraNow.getUTCMinutes() >= 55, "too close to midnight for a later-today time");
  const hh = sameDay ? later.getUTCHours() : 23;
  const mm = sameDay ? 0 : 59;
  const typed = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  const shown = `Open till ${hh % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${hh < 12 ? "am" : "pm"}`;

  await page.goto("/h/check");
  await page.getByRole("button", { name: "Demo login" }).click();
  const antenatal = page.getByRole("group", { name: "Antenatal clinic" });
  await antenatal.getByText("Open", { exact: true }).click();
  const till = antenatal.getByLabel(/time for Antenatal clinic/);
  if (!(await till.isVisible())) await antenatal.getByText(/till time/i).click();
  await till.fill(typed);
  await page.getByRole("button", { name: "Confirm and publish" }).click();
  await expect(page.getByRole("status")).toContainText("Published");
  await page.goto("/facility/f0000000-0000-4000-8000-000000000001?card=nhis&demo=1");
  await expect(page.getByText(shown).first()).toBeVisible();
});

test.afterAll(async ({ browser }) => {
  // Leave the demo story as the pitch expects it.
  await resetDemo(browser);
});
