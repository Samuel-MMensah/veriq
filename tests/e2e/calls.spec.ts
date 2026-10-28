import { expect, test, type Page } from "@playwright/test";
import { LOCAL_ADMIN, resetDemo, signInAdmin } from "./helpers";

// Prompt 10b: verification calls by the Veriq team. A real admin records a call on the form and
// imports a paper call; patients then see rule B-V with its source and date; the summary (the
// pitch number) counts both. Local data mode only: this saves calls on real facilities.
test.skip(Boolean(process.env.E2E_BASE_URL), "saves calls on real facilities; local data mode only");
test.describe.configure({ mode: "serial" });

// Facilities no other test uses, so their badges change nothing elsewhere.
const MADINA = "Madina Polyclinic";
const TEMA_REF = "greater-accra-2026-10-26.csv#row-411";
let madinaId = "";

// Like the other staff specs: warms the server and its database before the first sign-in.
test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

/** "YYYY-MM-DD HH:MM" in Accra time (GMT), minutes ago. */
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString().slice(0, 16).replace("T", " ");

/** The NHIS row of the summary CSV, as numbers: called, matched, listed but refuses, not listed but accepts. */
async function nhisSummary(page: Page): Promise<number[]> {
  const res = await page.request.get("/admin/calls/summary/csv");
  expect(res.status()).toBe(200);
  const row = (await res.text()).split("\r\n").find((l) => l.startsWith("NHIS,"))!;
  return row.split(",").slice(1, 5).map(Number);
}

test("an admin records a call on the form: answers per card, phone, services; checks come first", async ({ page }) => {
  await signInAdmin(page, "/admin/calls");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Verification calls");
  const before = await nhisSummary(page);

  await page.getByRole("link", { name: "Record a call" }).click();
  await page.getByLabel("Search by name, district or source row").fill("madina polyclinic");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: new RegExp(`^${MADINA}`) }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(MADINA);
  madinaId = new URL(page.url()).searchParams.get("facility")!;

  // A placeholder number and a "partial" with no note are caught, and what was typed stays.
  await page.getByLabel("Who answered").fill("Front desk");
  await page.getByLabel("Number reached").fill("+233 000 000 001");
  const nhis = page.getByRole("group", { name: "NHIS" });
  await nhis.getByText("Accepts", { exact: true }).click();
  await page.getByRole("group", { name: "Cosmopolitan Health" }).getByText("Partial", { exact: true }).click();
  await page.getByLabel("What is partial? (needed)").fill(" ");
  await page.getByRole("button", { name: "Save the call" }).click();
  await expect(page.getByText("Check the marked fields.")).toBeVisible();
  await expect(page.getByText("That isn't a number we can call", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Who answered")).toHaveValue("Front desk");

  await page.getByLabel("Number reached").fill("030 254 1234");
  await page.getByLabel("What is partial? (needed)").fill("top-up for scans");
  await page.getByLabel("Antenatal clinic").check();
  await page.getByLabel("Usual opening hours").fill("Mon–Sat 8 am to 5 pm");
  await page.getByRole("button", { name: "Save the call" }).click();

  await expect(page.getByRole("status")).toContainText(`Call saved for ${MADINA}`);
  const calls = page.getByRole("region", { name: /Calls/ });
  await expect(calls).toContainText("NHIS: accepts");
  await expect(calls).toContainText("Cosmopolitan Health: partial (top-up for scans)");
  await expect(calls).toContainText(`Front desk · 0302541234 · by ${LOCAL_ADMIN.email}`);

  // Listed on the NHIA list and accepts: one more NHIS answer that matches.
  const after = await nhisSummary(page);
  expect(after).toEqual([before[0]! + 1, before[1]! + 1, before[2], before[3]]);
});

test("patients see rule B-V with its source and date, the phone and the services (rule 4)", async ({ page }) => {
  await page.goto(`/facility/${madinaId}?card=nhis&demo=0`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(MADINA);
  await expect(page.getByText("Takes NHIS").first()).toBeVisible();
  await expect(page.getByText(/Veriq call · (just now|\d+ min ago)/).first()).toBeVisible();
  await expect(page.getByText(/Phone and services: Veriq call, \d+ \w{3} \d{4}/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Call", exact: true })).toHaveAttribute("href", "tel:0302541234");
  await expect(page.getByText("SAMPLE DATA")).toHaveCount(0);
  // The card answer for Cosmopolitan: partial, with top-ups.
  await expect(page.getByText(/Veriq call · .* · with top-ups/)).toBeVisible();
});

test("a paper call imports after a dry-run preview; a repeat is skipped, never counted twice", async ({ page }) => {
  await signInAdmin(page, "/admin/calls/import");
  const before = await nhisSummary(page);
  const header = (await (await page.request.get("/admin/calls/template")).text()).trim();
  expect(header).toBe(
    "called_at,facility_ref,facility_name,caller_email,answered_role,phone_reached,nhis,nhis_note,adom-care,adom-care_note,cosmopolitan,cosmopolitan_note,prudential,prudential_note,sika-health,sika-health_note,services,usual_hours,location",
  );
  const row = `${minutesAgo(30)},${TEMA_REF},Tema Polyclinic,${LOCAL_ADMIN.email},Records,0303 202 123,does_not,,not_asked,,,,,,,,lab,,`;
  await page.getByLabel("Or paste the rows").fill(`${header}\n${row}\n`);
  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.getByRole("region", { name: /Check the preview/ });
  await expect(preview).toContainText("1 ready of 1");
  await expect(preview).toContainText("Ready");
  // Nothing saved by the preview.
  expect(await nhisSummary(page)).toEqual(before);

  await page.getByRole("button", { name: "Save 1 call" }).click();
  await expect(page.getByRole("status")).toContainText("Saved 1 call");
  // Listed on the NHIA list but says no: one more "listed but refuses".
  expect(await nhisSummary(page)).toEqual([before[0]! + 1, before[1], before[2]! + 1, before[3]]);

  // The same sheet again: a duplicate, so nothing to save.
  await page.goto("/admin/calls/import");
  await page.getByLabel("Or paste the rows").fill(`${header}\n${row}\n`);
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("region", { name: /Check the preview/ })).toContainText("Already saved");
  await expect(page.getByRole("button", { name: "Save 0 calls" })).toBeDisabled();
});

test("the summary page shows the date range and the per-card table; the CSV is admins only", async ({ page, browser }) => {
  await signInAdmin(page, "/admin/calls/summary");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What the calls found");
  await expect(page.getByText(/^All calls · \d+ \w{3} \d{4}( to \d+ \w{3} \d{4})?$/)).toBeVisible();
  const nhisRow = page.getByRole("row", { name: /^NHIS/ });
  await expect(nhisRow).toBeVisible();
  const stranger = await (await browser.newContext()).newPage();
  expect((await stranger.request.get("/admin/calls/summary/csv")).status()).toBe(403);
});
