// Pitch screenshots of the demo site. Resets the demo data first (demo admin), then takes
// viewport-only shots: phone 390x844 at 2x, desktop 1280x800. Reports any "Was open till".
// Run from the repo root: node scripts/pitch-shots.mjs [base] [outDir]
// (defaults: the demo site, docs/pitch-screens). Then re-zip docs/pitch-screens.zip.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] ?? "https://veriq-demo-snowy.vercel.app";
const out = process.argv[3] ?? "docs/pitch-screens";
mkdirSync(out, { recursive: true });

const AKOMA = "f0000000-0000-4000-8000-000000000001";
const NEAR = "lat=5.545&lng=-0.265&area=dansoman";
const browser = await chromium.launch();
const log = [];

async function settle(page) {
  await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 30_000 });
  await page.getByText("Finding emergency units near you").waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(600); // let the soft card entrance finish
}

async function shot(page, name) {
  await settle(page);
  await page.screenshot({ path: join(out, `${name}.png`), animations: "disabled" }); // viewport only
  const text = await page.locator("body").innerText();
  log.push({ name, url: page.url(), wasOpenTill: /Was open till/i.test(text), openTill: (text.match(/Open till [^\n·]+/) || [null])[0], sample: /SAMPLE DATA/.test(text) });
}

// 1. Reset the demo data as the demo presenter.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(base + "/admin/demo");
  await page.getByRole("button", { name: "Demo login" }).click();
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await page.getByRole("status").filter({ hasText: "The demo story starts fresh." }).waitFor({ timeout: 30_000 });
  log.push({ name: "reset", ok: true, at: new Date().toISOString() });
  await ctx.close();
}

// 2. Phone, patient screens (the demo site opens in demo mode).
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${base}/results?service=antenatal&card=nhis&${NEAR}&r=5`);
  await shot(page, "01-results-antenatal-nhis");
  await page.goto(`${base}/facility/${AKOMA}?lat=5.545&lng=-0.265&card=nhis`);
  await shot(page, "02-akoma-hospital");
  await page.goto(`${base}/facility/${AKOMA}/report?card=nhis`);
  await shot(page, "03-akoma-was-your-card-accepted");
  await page.goto(`${base}/emergency`);
  await shot(page, "04-emergency");
  await page.goto(`${base}/results?service=antenatal&card=cosmopolitan&${NEAR}&r=5`);
  await shot(page, "05-results-antenatal-cosmopolitan");
  await ctx.close();
}

// 3. Phone, hospital morning check (Akoma, demo login).
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(base + "/h/check");
  await page.getByRole("button", { name: "Demo login" }).click();
  await page.getByRole("button", { name: "Publish" }).waitFor({ timeout: 30_000 });
  await shot(page, "06-akoma-morning-check");
  await ctx.close();
}

// 4. Desktop 1280, insurer network view (NHIS, demo login), after the reset above.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(base + "/i/network");
  await page.getByRole("button", { name: "Demo login" }).click();
  await page.getByRole("listitem").filter({ hasText: "Members refused" }).waitFor({ timeout: 30_000 });
  await shot(page, "07-insurer-network-1280");
  await ctx.close();
}

await browser.close();
writeFileSync(join(out, "check.json"), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 1));
