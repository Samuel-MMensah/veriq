import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Local data mode (VERIQ_DATA=local) loads PGlite at runtime; keep it out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Rule 7 (3G): the CSS (about 8 KB gzipped, Tailwind) arrives inside the HTML, so first paint
    // doesn't wait for a separate stylesheet request queued behind the page's scripts.
    inlineCss: true,
  },
};

export default nextConfig;
