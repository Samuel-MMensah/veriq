import { expect, test, type Page } from "@playwright/test";
import { demoModeInEveryTest, resetDemo } from "./helpers";

demoModeInEveryTest();

// Prompt 6: screens 5, 6 and 13. Each test gets a fresh browser, so an empty phone.

// Start from the demo story, whatever ran before (Prompt 8 reset).
test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

async function addCard(page: Page, card: { type: string; last4: string; name: string; expires?: string; family?: string }) {
  await page.goto("/cards");
  await page.getByRole("button", { name: "Add a card" }).click();
  await page.getByLabel("Card type").selectOption({ label: card.type });
  await page.getByLabel("Last 4 digits of the card number").fill(card.last4);
  await page.getByLabel("Card holder's name").fill(card.name);
  if (card.expires) await page.getByLabel("Expiry month (optional)").fill(card.expires);
  if (card.family) await page.getByLabel("Family on this card (optional)").fill(card.family);
  await page.getByRole("button", { name: "Save on this phone" }).click();
  await expect(page.getByLabel(`Card ending ${card.last4}`)).toBeVisible();
}

test("my cards: saved on the phone, last 4 digits only, and never sent to the server (rule 2)", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", (r) => sent.push(`${r.url()} ${r.postData() ?? ""}`));

  await page.goto("/cards");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My cards");
  await expect(page.getByText("Saved on this phone only")).toBeVisible();

  // Anything but 4 digits is refused.
  await page.getByRole("button", { name: "Add a card" }).click();
  await page.getByLabel("Last 4 digits of the card number").fill("48a1");
  await page.getByLabel("Card holder's name").fill("Ama");
  await page.getByRole("button", { name: "Save on this phone" }).click();
  await expect(page.getByText("Type only the last 4 digits of the card number.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await addCard(page, { type: "NHIS", last4: "4821", name: "Ama", expires: "2030-03", family: "Kofi (son)" });
  await addCard(page, { type: "Cosmopolitan Health", last4: "0193", name: "Ama", family: "Kofi (son), Esi" });
  await expect(page.getByText("DEFAULT", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Renew by Mar 2030")).toBeVisible();
  await expect(page.getByText("NHIS · Cosmopolitan Health dependant")).toBeVisible(); // Kofi
  await expect(page.getByText(/We'll remind you a month before your NHIS card expires \(Mar 2030\)\. Renew by dialling \*929#\./)).toBeVisible();

  // Still there after a reload: it lives in the phone's IndexedDB.
  await page.reload();
  await expect(page.getByLabel("Card ending 4821")).toBeVisible();

  // Find puts the saved card first and picks it; the search link carries only the card type.
  await page.goto("/find");
  await expect(page.getByText("Saved card · Ama").first()).toBeVisible();
  await expect(page.getByLabel(/^NHIS/)).toBeChecked();
  await page.getByRole("button", { name: "Show hospitals that take NHIS" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("4 hospitals near Dansoman");

  // Nothing about the cards ever left the phone.
  for (const request of sent) {
    expect(request).not.toContain("4821");
    expect(request).not.toContain("0193");
    expect(request).not.toMatch(/Ama|Kofi|Esi/);
  }
});

test("emergency: 112 and 193; S2 order; the card never changes the list (rules 3 and S2)", async ({ page }) => {
  const units = () => page.getByRole("heading", { level: 3 }).allTextContents();

  await page.goto("/emergency");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Get help now. Cards come later.");
  await expect(page.getByRole("link", { name: /112/ })).toHaveAttribute("href", "tel:112");
  await expect(page.getByRole("link", { name: /193/ })).toHaveAttribute("href", "tel:193");
  await expect(page.getByText("SAMPLE DATA")).toBeVisible();
  const before = await units();
  expect(before).toEqual(["Akoma Mission Hospital", "Westhills District Hospital", "Pinecrest Specialist Hospital"]);
  await expect(page.getByText("Takes your", { exact: false })).toHaveCount(0);

  await addCard(page, { type: "NHIS", last4: "4821", name: "Ama" });
  await page.goto("/emergency");
  expect(await units()).toEqual(before);
  await expect(page.getByText("Takes your NHIS card").first()).toBeVisible();
  await expect(page.getByText("NHIS reported refused")).toBeVisible(); // Pinecrest: shown, not hidden

  await addCard(page, { type: "Cosmopolitan Health", last4: "0193", name: "Ama" });
  await page.goto("/emergency");
  expect(await units()).toEqual(before);
});

test("help: explains the USSD menu and the SMS; emergency call button", async ({ page }) => {
  await page.goto("/help");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No smartphone? No data? Dial Veriq.");
  await expect(page.getByText("Dial *[code]#")).toBeVisible();
  await expect(page.getByText("1 Find hospital")).toBeVisible();
  await expect(page.getByText("Code not yet registered.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Emergency? Call 112" })).toHaveAttribute("href", "tel:112");
});

test("the USSD endpoint answers in the aggregator format", async ({ request }) => {
  const res = await request.post("/api/ussd", {
    form: { sessionId: "e2e", serviceCode: "*000#", phoneNumber: "+233200000000", text: "4" },
  });
  expect(await res.text()).toBe("END Emergency: call 112\nAmbulance: call 193\nYour card never stops emergency care.");
});
