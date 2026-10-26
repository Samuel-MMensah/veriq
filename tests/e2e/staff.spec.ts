import { expect, test, type Browser, type Page } from "@playwright/test";
import { LOCAL_ADMIN, resetDemo, signIn, signInAdmin } from "./helpers";

// Prompt 10: real staff sign-in (email and password, accounts made by an admin, nothing emailed),
// role checks, hospital verification, held reports and the admin log. Local data mode only: these
// make accounts and change data.
test.skip(Boolean(process.env.E2E_BASE_URL), "makes accounts; local data mode only");
test.describe.configure({ mode: "serial" });

const DANSOMAN_POLY = "Dansoman Polyclinic";
const HOSPITAL = { name: "Ama Mensah", email: "ama.desk@dansoman.test", password: "green-river-runs-42" };
const INSURER = { name: "Kojo Boateng", email: "kojo@nhis.test", password: "blue-harbour-sails-7" };
let hospitalOneTime = "";
let insurerOneTime = "";

test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

async function fresh(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

/** Makes an account on /admin/staff and returns the one-time password shown once. */
async function makeAccount(page: Page, who: { name: string; email: string }, role: "Hospital staff" | "Insurer staff", link: string) {
  await page.goto("/admin/staff");
  await page.getByLabel("Name").fill(who.name);
  await page.getByLabel("Work email").fill(who.email);
  await page.getByText(role, { exact: true }).click();
  const select = page.getByLabel(role === "Hospital staff" ? "Hospital" : "Insurer", { exact: true });
  const value = await select.locator("option", { hasText: link }).first().getAttribute("value");
  await select.selectOption(value!);
  await page.getByRole("button", { name: "Make the account" }).click();
  await expect(page.getByRole("status")).toContainText(`Account made for ${who.email}`);
  return (await page.locator(".font-mono").textContent())!.trim();
}

test("an admin signs in with email and password; a wrong password is refused in plain words", async ({ page }) => {
  await page.goto("/admin");
  await signIn(page, LOCAL_ADMIN.email, "not-the-password");
  await expect(page.getByText("That email and password don't match an account.")).toBeVisible();
  await signIn(page, LOCAL_ADMIN.email, LOCAL_ADMIN.password);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Good");
  await expect(page.getByRole("list", { name: "To do" })).toContainText("Hospitals waiting for verification");
  await expect(page.getByRole("list", { name: "To do" })).toContainText("Held reports to review");
  await expect(page.getByRole("list", { name: "To do" })).toContainText("Facilities needing a location");
  // Rule 4: each count says where it comes from and when.
  await expect(page.getByText(/Counted at/).first()).toBeVisible();
});

test("an admin makes a hospital account and an insurer account, each with a one-time password", async ({ page }) => {
  await signInAdmin(page, "/admin/staff");
  hospitalOneTime = await makeAccount(page, HOSPITAL, "Hospital staff", DANSOMAN_POLY);
  expect(hospitalOneTime).toMatch(/^\w{4}-\w{4}-\w{4}$/);
  insurerOneTime = await makeAccount(page, INSURER, "Insurer staff", "NHIS");
  await page.reload();
  const accounts = page.getByRole("region", { name: /Accounts/ });
  await expect(accounts).toContainText(HOSPITAL.email);
  await expect(accounts).toContainText("Not signed in yet");
});

test("first sign-in: the one-time password must be replaced by the person's own", async ({ browser }) => {
  const page = await fresh(browser);
  await page.goto("/h/check");
  await signIn(page, HOSPITAL.email, hospitalOneTime);
  await expect(page).toHaveURL(/\/staff\/password/);
  await expect(page.getByRole("heading", { name: "Set your own password" })).toBeVisible();
  // Trying to skip it sends them back.
  await page.goto("/h/check");
  await expect(page).toHaveURL(/\/staff\/password/);

  await page.getByLabel("The password you were given").fill(hospitalOneTime);
  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("New password again").fill("short");
  await page.getByRole("button", { name: "Save my password" }).click();
  await expect(page.getByText("Use at least 10 characters.")).toBeVisible();

  await page.getByLabel("The password you were given").fill(hospitalOneTime);
  await page.getByLabel("New password", { exact: true }).fill(HOSPITAL.password);
  await page.getByLabel("New password again").fill(HOSPITAL.password);
  await page.getByRole("button", { name: "Save my password" }).click();
  await expect(page).toHaveURL(/\/h\/check\?password=set/);
  await expect(page.getByRole("status")).toContainText("Your password is saved.");
  // Not verified yet: it can look but not publish.
  await expect(page.getByText("Waiting for verification")).toBeVisible();

  // The one-time password no longer works.
  const again = await fresh(browser);
  await again.goto("/h/check");
  await signIn(again, HOSPITAL.email, hospitalOneTime);
  await expect(again.getByText("That email and password don't match an account.")).toBeVisible();
});

test("role checks: a hospital user can't open /admin, and an insurer can't verify a hospital", async ({ browser }) => {
  const hospital = await fresh(browser);
  await hospital.goto("/admin");
  await signIn(hospital, HOSPITAL.email, HOSPITAL.password);
  await expect(hospital.getByText("This page is for Veriq admins.")).toBeVisible();
  await expect(hospital.getByText("You are signed in as hospital staff.")).toBeVisible();
  await hospital.goto("/admin/hospitals");
  await expect(hospital.getByText("This page is for Veriq admins.")).toBeVisible();
  await expect(hospital.getByRole("button", { name: "Mark as verified" })).toHaveCount(0);

  const insurer = await fresh(browser);
  await insurer.goto("/i/network");
  await signIn(insurer, INSURER.email, insurerOneTime);
  await insurer.getByLabel("The password you were given").fill(insurerOneTime);
  await insurer.getByLabel("New password", { exact: true }).fill(INSURER.password);
  await insurer.getByLabel("New password again").fill(INSURER.password);
  await insurer.getByRole("button", { name: "Save my password" }).click();
  await expect(insurer.getByRole("heading", { name: "Network health" })).toBeVisible();
  // A real insurer account sees real facilities only: no SAMPLE DATA (rule D2).
  await expect(insurer.getByText("SAMPLE DATA", { exact: true })).toHaveCount(0);
  await insurer.goto("/admin/hospitals");
  await expect(insurer.getByText("This page is for Veriq admins.")).toBeVisible();
  await expect(insurer.getByRole("button", { name: "Mark as verified" })).toHaveCount(0);
});

test("verification: the admin checks the claim, marks it verified with who and when, and the log shows it", async ({ page, browser }) => {
  await signInAdmin(page, "/admin/hospitals");
  const waiting = page.getByRole("region", { name: /Waiting for verification/ });
  await waiting.getByRole("link", { name: new RegExp(DANSOMAN_POLY) }).click();
  await expect(page.getByText("Waiting for verification").first()).toBeVisible();
  await expect(page.getByText(/From the NHIA list/).first()).toBeVisible();

  // Both checks are required.
  await page.getByRole("button", { name: "Mark as verified" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Check the name against the NHIA list first." })).toBeVisible();
  await page.getByLabel(/The name matches the NHIA list/).check();
  await page.getByLabel(/I called the hospital back/).check();
  await page.getByLabel("The number you called, and where you found it").fill("030 231 0000, GHS facility directory");
  await page.getByRole("button", { name: "Mark as verified" }).click();
  await expect(page.getByRole("status")).toContainText("is verified");
  await expect(page.getByRole("region", { name: "Status" })).toContainText(`Verified by ${LOCAL_ADMIN.email}`);
  const history = page.getByRole("list", { name: "History, newest first" });
  await expect(history).toContainText("Verified the hospital");
  await expect(history).toContainText("Called back on 030 231 0000, GHS facility directory");
  await expect(history).toContainText("Made the account");

  // The hospital's staff no longer see "waiting".
  const hospital = await fresh(browser);
  await hospital.goto("/h/check");
  await signIn(hospital, HOSPITAL.email, HOSPITAL.password);
  await expect(hospital.getByRole("heading", { name: "Morning check" })).toBeVisible();
  await expect(hospital.getByText("Waiting for verification")).toHaveCount(0);

  // The overview's log shows it too.
  await page.goto("/admin");
  await expect(page.getByRole("region", { name: /Recent admin actions/ })).toContainText("Verified the hospital");
});

test("a password reset gives a new one-time password and ends the old one", async ({ page, browser }) => {
  await signInAdmin(page, "/admin/staff");
  await page.getByRole("region", { name: /Accounts/ }).getByRole("link", { name: new RegExp(HOSPITAL.name) }).first().click();
  await page.getByRole("button", { name: "Reset password" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reset password" }).click();
  const fresh1Time = (await page.getByRole("dialog").locator(".font-mono").textContent())!.trim();
  expect(fresh1Time).toMatch(/^\w{4}-\w{4}-\w{4}$/);
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  const hospital = await fresh(browser);
  await hospital.goto("/h/check");
  await signIn(hospital, HOSPITAL.email, HOSPITAL.password);
  await expect(hospital.getByText("That email and password don't match an account.")).toBeVisible();
  await signIn(hospital, HOSPITAL.email, fresh1Time);
  await expect(hospital).toHaveURL(/\/staff\/password/);
});

test("a disabled account can't sign in, and its open session ends at once", async ({ page, browser }) => {
  const insurer = await fresh(browser);
  await insurer.goto("/i/network");
  await signIn(insurer, INSURER.email, INSURER.password);
  await expect(insurer.getByRole("heading", { name: "Network health" })).toBeVisible();

  await signInAdmin(page, "/admin/staff");
  await page.getByRole("region", { name: /Accounts/ }).getByRole("link", { name: new RegExp(INSURER.name) }).first().click();
  await page.getByRole("button", { name: "Switch off" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Why?").fill("Left the network team");
  await dialog.getByRole("button", { name: "Switch off" }).click();
  await expect(page.getByRole("status")).toContainText("The account is switched off.");
  await expect(page.getByRole("list", { name: "History, newest first" })).toContainText("Left the network team");

  await insurer.reload();
  await expect(insurer.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await signIn(insurer, INSURER.email, INSURER.password);
  await expect(insurer.getByText(/don't match an account|switched off/)).toBeVisible();
});

test("held reports (rule A): release one with a reason after a confirmation; reject another; both logged", async ({ page, request }) => {
  // 11 reports on one demo hospital within the hour: the 11th and later are held.
  const facilityId = "f0000000-0000-4000-8000-000000000003"; // Gbawe (demo)
  for (let i = 0; i < 13; i++) {
    const res = await request.post("/api/reports", {
      data: { deviceId: `e2e-burst-device-${String(i).padStart(4, "0")}`, facilityId, insurerId: "a0000000-0000-4000-8000-000000000001", outcome: "refused" },
    });
    expect(res.status()).toBe(201);
  }
  // Demo hospitals show in demo mode (rule D2).
  await signInAdmin(page, "/admin/reports?demo=1");
  const held = page.locator("li").filter({ hasText: "held by the burst rule" }).filter({ hasText: "Gbawe Community Clinic" });
  await expect(held.first()).toBeVisible();
  const before = await held.count();
  expect(before).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("SAMPLE DATA", { exact: true }).first()).toBeVisible();

  await held.first().getByRole("button", { name: "Release" }).click();
  let dialog = page.getByRole("dialog").filter({ hasText: "Release this report?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(held).toHaveCount(before); // nothing happens without the confirmation

  await held.first().getByRole("button", { name: "Release" }).click();
  dialog = page.getByRole("dialog").filter({ hasText: "Release this report?" });
  await dialog.getByLabel("Why?").fill("Busy clinic day, reports look real");
  await dialog.getByRole("button", { name: "Release" }).click();
  await expect(page.getByRole("status")).toContainText("Released. The report counts from now on.");
  await expect(held).toHaveCount(before - 1);

  await held.first().getByRole("button", { name: "Reject" }).click();
  dialog = page.getByRole("dialog").filter({ hasText: "Reject this report?" });
  await dialog.getByLabel("Why?").fill("Same burst pattern");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByRole("status")).toContainText("Rejected. The report will never count.");
  await expect(held).toHaveCount(before - 2);

  await page.goto(`/admin/hospitals/${facilityId}`);
  const history = page.getByRole("list", { name: "History, newest first" });
  await expect(history).toContainText("Released a held report");
  await expect(history).toContainText("Rejected a held report");
  await expect(history).toContainText("Same burst pattern");
});

test("morning check (rule F): a verified hospital sets 'open till' a time, and patients see it", async ({ page }) => {
  await page.goto("/h/check");
  await page.getByRole("button", { name: "Demo login" }).click();
  const antenatal = page.getByRole("group", { name: "Antenatal clinic" });
  await antenatal.getByText("Open", { exact: true }).click();
  const till = antenatal.getByLabel(/time for Antenatal clinic/);
  if (!(await till.isVisible())) await antenatal.getByText(/till time/i).click();
  await till.fill("23:58");
  await page.getByRole("button", { name: "Confirm and publish" }).click();
  await expect(page.getByRole("status")).toContainText("Published");
  await page.goto("/facility/f0000000-0000-4000-8000-000000000001?card=nhis&demo=1");
  await expect(page.getByText("Open till 11:58 pm").first()).toBeVisible();
});
