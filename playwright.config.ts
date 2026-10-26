import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  // One test at a time, in file order: every test shares one server with one in-memory database,
  // and some tests change it (reports, the morning check).
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    // E2E_BASE_URL runs the tests against a deployed site (e.g. the 3G check on Vercel) instead of a local build.
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  // Mobile first (rule 7): test at the 390 px design width.
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Local data mode: fresh sample data in memory on every start, no Supabase needed (see lib/db/server.ts).
        command: `npm run build && npx next start -p ${port}`,
        // A real admin account in the throwaway local database (Prompt 10 sign-in tests); see lib/auth/create-admin.ts.
        env: { VERIQ_DATA: "local", VERIQ_LOCAL_ADMIN: "admin@veriq.test:local-admin-pass" },
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
});
