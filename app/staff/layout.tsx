import type { Metadata } from "next";

// Staff sign-in screens: never indexed by search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
