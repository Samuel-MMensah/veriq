import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { DemoSiteBar } from "@/components/ui/DemoSiteBar";
import { isDemoSite } from "@/lib/demo/site";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  // Rule 7 (3G): text paints at once in the fallback font (swap); not preloading the font keeps its
  // 27 KB off the line while the first screen loads.
  preload: false,
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: { default: "Veriq Health", template: "%s · Veriq Health" },
  description: "Know before you go. See which hospitals really accept your card.",
  applicationName: "Veriq Health",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b6e4f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="bg-page font-sans text-ink antialiased">
        {/* Team decision 2026-10-28: a "Demo" strip on every screen of the demo site only. */}
        {isDemoSite() && <DemoSiteBar />}
        {children}
      </body>
    </html>
  );
}
