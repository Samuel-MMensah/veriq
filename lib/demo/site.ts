// The demo deployment (the pitch site) sets VERIQ_DEMO_SITE=on; the real site never does
// (docs/DEPLOY.md). Only reads the environment, so static pages can use it (it is set at build time).
import { demoParamAllowed } from "@/lib/rules/directory";

export function isDemoSite(): boolean {
  return process.env.VERIQ_DEMO_SITE === "on";
}

/**
 * rule D2: may ?demo=1 (and its cookie) turn demo mode on here? Only on the demo site, in local data
 * mode (the test suites, VERIQ_DATA=local) and on the development server. Never on the real site.
 */
export function demoParamAllowedHere(): boolean {
  return demoParamAllowed({
    demoSite: isDemoSite(),
    localData: process.env.VERIQ_DATA === "local",
    development: process.env.NODE_ENV === "development",
  });
}
