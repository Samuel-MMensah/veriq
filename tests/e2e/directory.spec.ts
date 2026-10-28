import { expect, test } from "@playwright/test";
import { resetDemo, signInAdmin } from "./helpers";

// Prompt 9: the real NHIA directory, outside demo mode (rules 1, D1–D3, S2, R1), and the Call
// button on "Call first" cards. Runs locally and against the demo deployment (which opens in demo
// mode, so every link here says demo=0 or demo=1):
//   E2E_BASE_URL=<demo deployment URL> npx playwright test tests/e2e/directory.spec.ts

const SEARCH = "/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman&r=5";
/** Real mode: the NHIA directory. */
const DANSOMAN_NHIS = `${SEARCH}&demo=0`;
/** Demo mode: the demo story. */
const DANSOMAN_DEMO = `${SEARCH}&demo=1`;
const SOURCE = "From the NHIA list, October 2026";
const DEMO_NAMES = ["Akoma Mission Hospital", "Lakeside Family Clinic", "Gbawe Community Clinic", "Pinecrest Specialist Hospital"];

test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

test("a search near Dansoman shows real NHIA facilities with the source line and no SAMPLE DATA tag", async ({ page }) => {
  await page.goto(DANSOMAN_NHIS);
  // Rule D3: no real facility has services yet, so they show in the second group.
  const group = page.getByRole("region", { name: "Services not listed. Call to ask" });
  await expect(group).toBeVisible();
  await expect(group.getByText("By distance")).toBeVisible(); // rule D3 sort, said briefly
  const cards = group.getByRole("listitem");
  expect(await cards.count()).toBeGreaterThan(0);
  expect(await cards.count()).toBeLessThanOrEqual(10);
  await expect(group.getByRole("heading", { name: "Dansoman Polyclinic" })).toBeVisible();

  // Rule D1: every card names its source; for NHIS, rule B4 says "not confirmed yet".
  for (let i = 0; i < (await cards.count()); i++) {
    const card = cards.nth(i);
    await expect(card).toContainText(SOURCE);
    await expect(card).toContainText("NHIS not confirmed yet");
    await expect(card).toContainText("On NHIA list, not checked yet. Call first");
    await expect(card).toContainText("NHIA type:");
    await expect(card).not.toContainText(/Pharmacy|Chemical Shop/i);
    // No fact without a source: no opening status, no top-up, no patient count.
    await expect(card).not.toContainText(/Open|Closed|top-up|patients confirmed/);
  }

  // Rule 1: real facilities only, so no tag; and no demo hospital (rule D2).
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toHaveCount(0);
  for (const name of DEMO_NAMES) await expect(page.getByText(name)).toHaveCount(0);
});

test("SAMPLE DATA shows only while a demo hospital is on the screen (rule 1, both cases)", async ({ page }) => {
  await page.goto(DANSOMAN_NHIS);
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toHaveCount(0);

  await page.goto(DANSOMAN_DEMO);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("4 hospitals near Dansoman");
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toBeVisible();
  // Demo mode shows the demo story alone (rule D2): no NHIA group.
  await expect(page.getByText(SOURCE)).toHaveCount(0);

  // ?demo=1 set the cookie, so the next screen is still in demo mode; ?demo=0 leaves it.
  await page.goto("/emergency");
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toBeVisible();
  await page.goto(DANSOMAN_NHIS);
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toHaveCount(0);
  await page.goto("/emergency");
  await expect(page.getByText("Emergency not checked. Call first").first()).toBeVisible();
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toHaveCount(0);
});

test("the hospital page of a real facility: source line, OpenStreetMap credit, nothing invented, reports closed (R1)", async ({ page }) => {
  await page.goto(DANSOMAN_NHIS);
  await page.getByRole("link", { name: /Dansoman Polyclinic/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dansoman Polyclinic");
  await expect(page.getByText(SOURCE)).toBeVisible();
  await expect(page.getByText("Map: OpenStreetMap")).toBeVisible();
  await expect(page.getByRole("link", { name: "© OpenStreetMap contributors" })).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/copyright",
  );
  await expect(page.getByText("Services not listed yet. Call to ask.")).toBeVisible();
  await expect(page.getByText("No phone listed")).toBeVisible();
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toHaveCount(0);
  // Rule R1: REPORTS_LIVE is off, so no report link on a real facility.
  await expect(page.getByText("Reporting opens soon. Call the hospital to check your card.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Been here? Tell others if your card worked" })).toHaveCount(0);

  // The report screen itself is closed too, even if someone opens its address.
  await page.goto(`${page.url().split("?")[0]}/report?card=nhis`);
  await expect(page.getByText("Reporting opens soon. Call the hospital to check your card.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toHaveCount(0);
});

test("rule R1 on the server: /api/reports refuses a report on a real facility", async ({ page, request }) => {
  await page.goto(DANSOMAN_NHIS);
  const href = await page.getByRole("link", { name: /Dansoman Polyclinic/ }).getAttribute("href");
  const facilityId = href!.split("/")[2]!.split("?")[0]!;
  const res = await request.post("/api/reports", {
    data: { deviceId: "e2e-r1-device-0001", facilityId, insurerId: "a0000000-0000-4000-8000-000000000001", outcome: "refused" },
  });
  expect(res.status()).toBe(403);
  expect(await res.json()).toMatchObject({ status: "closed" });
});

test("rule R1 on USSD: Report refusal is closed on the real line, open on the demo line", async ({ request }) => {
  const dial = (path: string) =>
    request.post(path, { form: { sessionId: "s1", serviceCode: "*920#", phoneNumber: "+233244000111", text: "3*1*1" } });
  expect(await (await dial("/api/ussd?demo=0")).text()).toBe("END Reporting opens soon. Call the hospital to check your card.");
  expect(await (await dial("/api/ussd?demo=1")).text()).toMatch(/^CON Which hospital\?/);
});

test("emergency mode lists real hospitals as 'Emergency not checked. Call first', with the source line (S2)", async ({ page }) => {
  await page.goto("/emergency?demo=0");
  await expect(page.getByRole("link", { name: /112/ })).toHaveAttribute("href", "tel:112");
  const units = page.getByRole("listitem").filter({ hasText: "Emergency not checked. Call first" });
  // The unit list streams in after 112 and 193 (Suspense), so wait for it before counting.
  await expect(units.first()).toBeVisible();
  expect(await units.count()).toBeGreaterThan(0);
  await expect(units.first()).toContainText(SOURCE);
  await expect(units.first()).toContainText(/NHIA type: (PRIMARY HOSPITAL|SECONDARY HOSPITAL|POLY2005)/);
  await expect(page.getByText(/Pharmacy/)).toHaveCount(0);
  // Sorted by distance.
  const km = (await units.locator("span", { hasText: / km$/ }).allTextContents()).map((t) => Number(t.replace(" km", "")));
  expect(km).toEqual([...km].sort((a, b) => a - b));
});

test("a 'Call first' card has a Call button beside its link, not inside it", async ({ page }) => {
  await page.goto(DANSOMAN_DEMO);
  const gbawe = page.getByRole("listitem").filter({ hasText: "Gbawe Community Clinic" });
  await expect(gbawe).toContainText("Call first");
  const call = gbawe.getByRole("link", { name: "Call Gbawe Community Clinic" });
  await expect(call).toHaveAttribute("href", /^tel:/);
  // Not nested: no link inside another link anywhere on the page.
  expect(await page.locator("a a").count()).toBe(0);
  // A card that isn't "Call first" has no Call button.
  const akoma = page.getByRole("listitem").filter({ hasText: "Akoma Mission Hospital" });
  await expect(akoma.getByRole("link", { name: /^Call / })).toHaveCount(0);
});

test("/admin/locations lists real facilities with no location; search, preview on the map, then save (rule D1)", async ({ page }) => {
  // It saves a location, so it never runs against the live site.
  test.skip(Boolean(process.env.E2E_BASE_URL), "changes real data; never on a deployed site");
  await signInAdmin(page, "/admin/locations");
  const count = async () => Number((await page.getByText(/without a location/).textContent())!.match(/(\d+) without/)![1]);
  const before = await count();
  expect(before).toBeGreaterThan(0);
  await expect(page.getByText("SAMPLE DATA", { exact: true })).toHaveCount(0);

  // Search by district opens the matching groups.
  const firstName = (await page.locator("details li p.font-semibold").first().textContent())!;
  await page.getByRole("searchbox", { name: "Search by name or district" }).fill(firstName);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(new RegExp(`match "${firstName}"`))).toBeVisible();
  const item = page.locator("details li").first();
  await expect(item).toContainText(firstName);

  // A typo is refused before saving; a point in Accra shows on the map, then saves as location_source = admin.
  const input = item.getByRole("textbox");
  await input.fill("-0.26, 5.56");
  await expect(item.getByText(/That point is outside Greater Accra/)).toBeVisible();
  await expect(item.getByRole("button", { name: "Save" })).toBeDisabled();
  await input.fill("5.5612, -0.2601");
  await expect(item.getByRole("img", { name: /Map preview/ })).toBeVisible();
  await expect(item.getByRole("link", { name: "OpenStreetMap contributors" })).toBeVisible();
  await item.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toContainText(`Location saved for ${firstName}.`);
  await page.goto("/admin/locations");
  expect(await count()).toBe(before - 1);
});
