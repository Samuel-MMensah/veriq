import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";

// Prompt 10 proof: full-page screenshots of every touched screen at 390 px, and the staff screens at
// 1280 px. Runs only when asked: SHOTS=docs/sessions/<session>/after npx playwright test screenshots
const DIR = process.env.SHOTS;
test.skip(!DIR, "Set SHOTS to a folder to take screenshots.");

const AKOMA = "f0000000-0000-4000-8000-000000000001";
const DEMO_RESULTS = "/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman&demo=1";
const REAL_RESULTS = "/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman&demo=0";

type Shot = { name: string; path: string; staff?: string; openFirst?: string; wide?: boolean };

const SHOTS: Shot[] = [
  { name: "01-first-open", path: "/?demo=1" },
  { name: "02-find", path: "/find" },
  { name: "03-results-demo", path: DEMO_RESULTS },
  { name: "04-results-real", path: REAL_RESULTS },
  { name: "05-hospital-demo", path: `/facility/${AKOMA}?lat=5.545&lng=-0.265&card=nhis&demo=1` },
  { name: "06-hospital-real", path: REAL_RESULTS, openFirst: "Dansoman Polyclinic" },
  { name: "07-report", path: `/facility/${AKOMA}/report?card=nhis&demo=1` },
  { name: "08-thanks", path: "/report/thanks" },
  { name: "09-emergency", path: "/emergency?demo=0" },
  { name: "10-cards", path: "/cards" },
  { name: "11-help", path: "/help" },
  { name: "12-morning-check", path: "/h/check", staff: "hospital" },
  { name: "13-admin", path: "/admin", staff: "admin" },
  { name: "14-admin-demo", path: "/admin/demo", staff: "admin" },
  { name: "15-admin-locations", path: "/admin/locations", staff: "admin" },
  { name: "16-admin-staff", path: "/admin/staff", staff: "admin" },
  { name: "17-admin-hospitals", path: "/admin/hospitals", staff: "admin" },
  { name: "18-admin-reports", path: "/admin/reports", staff: "admin" },
  { name: "19-sign-in", path: "/staff/sign-in" },
  { name: "20-design-sample", path: "/admin/design", staff: "admin" },
];

async function capture(page: Page, s: Shot, width: number) {
  await page.setViewportSize({ width, height: width > 500 ? 900 : 844 });
  const res = await page.goto(s.path);
  if (res?.status() === 404) return;
  const demo = page.getByRole("button", { name: "Demo login" });
  if (s.staff && (await demo.count())) await demo.first().click();
  if (s.openFirst) await page.getByRole("link", { name: new RegExp(s.openFirst) }).first().click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${DIR}/${s.name}-${width}.png`, fullPage: true, animations: "disabled" });
}

for (const s of SHOTS) {
  test(`screenshot ${s.name}`, async ({ page }) => {
    mkdirSync(DIR!, { recursive: true });
    await capture(page, s, 390);
    if (s.staff) await capture(page, s, 1280);
  });
}
