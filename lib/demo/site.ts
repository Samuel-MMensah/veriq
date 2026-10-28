// The demo deployment (the pitch site) sets VERIQ_DEMO_SITE=on; the real site never does
// (docs/DEPLOY.md). Only reads the environment, so static pages can use it (it is set at build time).
export function isDemoSite(): boolean {
  return process.env.VERIQ_DEMO_SITE === "on";
}
