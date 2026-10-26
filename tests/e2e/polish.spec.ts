import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { demoModeInEveryTest, resetDemo } from "./helpers";

demoModeInEveryTest();

// Prompt 8 polish, on every Phase 1 screen: WCAG 2 AA checks (contrast, labels, names) with axe,
// and touch targets of at least 44 px (rule 7).

const AKOMA = "f0000000-0000-4000-8000-000000000001";
// ?demo=0 opens a screen on the real NHIA directory (rule D2); the rest use the demo story.
const REAL_RESULTS = "/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman&demo=0";
const SCREENS: { name: string; path: string; staff?: string; openFirst?: string }[] = [
  { name: "first open", path: "/" },
  { name: "find", path: "/find" },
  { name: "results", path: "/results?service=antenatal&card=nhis&lat=5.545&lng=-0.265&area=dansoman" },
  { name: "hospital", path: `/facility/${AKOMA}?lat=5.545&lng=-0.265&card=nhis` },
  { name: "report", path: `/facility/${AKOMA}/report?card=nhis` },
  { name: "thanks", path: "/report/thanks" },
  { name: "how we check", path: "/how-we-check" },
  { name: "cards", path: "/cards" },
  { name: "emergency", path: "/emergency" },
  { name: "help", path: "/help" },
  { name: "morning check", path: "/h/check", staff: "hospital" },
  { name: "network health", path: "/i/network", staff: "insurer" },
  { name: "demo admin", path: "/admin/demo", staff: "admin" },
  { name: "results, real directory", path: REAL_RESULTS },
  { name: "hospital, real directory", path: REAL_RESULTS, openFirst: "Dansoman Polyclinic" },
  { name: "emergency, real directory", path: "/emergency?demo=0" },
  { name: "admin, needs a location", path: "/admin", staff: "admin" },
];

test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

async function open(page: Page, s: (typeof SCREENS)[number]) {
  await page.goto(s.path);
  if (s.staff) await page.getByRole("button", { name: "Demo login" }).click();
  if (s.openFirst) await page.getByRole("link", { name: new RegExp(s.openFirst) }).first().click();
  await page.waitForLoadState("networkidle");
}

for (const s of SCREENS) {
  test(`${s.name}: no WCAG 2 AA problems (axe)`, async ({ page }) => {
    await open(page, s);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const problems = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(problems).toEqual([]);
  });

  test(`${s.name}: every touch target is at least 44 px`, async ({ page }) => {
    await open(page, s);
    const small = await page.evaluate(() => {
      const targets = document.querySelectorAll<HTMLElement>(
        "button, select, input:not([type=hidden]):not([type=radio]), label:has(> input[type=radio]), a",
      );
      return [...targets]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return false; // not shown
          if (el.closest(".sr-only")) return false;
          // Links inside a sentence are exempt (WCAG 2.5.8 "inline").
          if (el.tagName === "A" && el.closest("p, td, li > p")) return false;
          return r.height < 44;
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().height)}px`);
    });
    expect(small).toEqual([]);
  });
}

test("network health: the turned-away table reads as stacked rows at 390 px, no sideways scroll (rule 7)", async ({ page }) => {
  await page.goto("/i/network");
  await page.getByRole("button", { name: "Demo login" }).click();
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(wide).toBe(false);
  const box = await table.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  // Each value carries its own label in the stacked layout.
  await expect(table.locator("td[data-label='Refusals']").first()).toBeVisible();
});
