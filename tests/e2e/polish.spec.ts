import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resetDemo } from "./helpers";

// Prompt 8 polish, on every Phase 1 screen: WCAG 2 AA checks (contrast, labels, names) with axe,
// and touch targets of at least 44 px (rule 7).

const AKOMA = "f0000000-0000-4000-8000-000000000001";
const SCREENS: { name: string; path: string; staff?: string }[] = [
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
];

test.beforeAll(async ({ browser }) => {
  await resetDemo(browser);
});

async function open(page: Page, s: (typeof SCREENS)[number]) {
  await page.goto(s.path);
  if (s.staff) await page.getByRole("button", { name: "Demo login" }).click();
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
