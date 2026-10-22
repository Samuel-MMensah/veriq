import { expect, test } from "@playwright/test";

// Every Phase 1 route from SPEC section 2 renders its screen title (built screens show their real heading).
const routes = [
  { path: "/", title: "Know before you go.", sample: false },
  { path: "/find", title: "Find care", sample: true },
  { path: "/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman", title: "4 hospitals near Dansoman", sample: true },
  { path: "/facility/f0000000-0000-4000-8000-000000000001", title: "Akoma Mission Hospital", sample: true },
  { path: "/facility/f0000000-0000-4000-8000-000000000001/report?card=nhis", title: "Was your NHIS card accepted?", sample: true },
  { path: "/report/thanks", title: "Thank you. The next person will know.", sample: true },
  { path: "/how-we-check", title: "Every badge tells you who said so, and when.", sample: false },
  { path: "/cards", title: "My cards", sample: false },
  { path: "/emergency", title: "Emergency mode", sample: true },
  { path: "/help", title: "Help: USSD and SMS", sample: false },
  { path: "/h/check", title: "Hospital morning check", sample: true },
  { path: "/i/network", title: "Insurer network health", sample: true },
];

for (const route of routes) {
  test(`${route.path} shows "${route.title}"`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(route.title);
    // Rule 1: data screens show SAMPLE DATA.
    await expect(page.getByText("SAMPLE DATA")).toHaveCount(route.sample ? 1 : 0);
  });
}

test("patient bottom bar has 44 px targets and works", async ({ page }) => {
  await page.goto("/find");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const label of ["Find", "Cards", "Saved", "Help"]) {
    const box = await nav.getByRole("link", { name: label }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44); // rule 7
  }
  await nav.getByRole("link", { name: "Cards" }).click();
  await expect(page).toHaveURL(/\/cards$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My cards");
});

test("first open has no bottom bar (screen 7)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
});

test("staff screens have no patient bottom bar", async ({ page }) => {
  await page.goto("/h/check");
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
});

test("PWA manifest is named Veriq Health", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  expect((await res.json()).name).toBe("Veriq Health");
});
