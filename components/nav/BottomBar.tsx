"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/find", label: "Find", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.3-4.3" },
  { href: "/cards", label: "Cards", icon: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 3h18M7 15h4" },
  { href: "/saved", label: "Saved", icon: "M6 4h12v16l-6-4-6 4V4Z" },
  { href: "/help", label: "Help", icon: "M3 12h4l3-8 4 16 3-8h4" },
] as const;

const HIDDEN_UNDER = ["/facility", "/how-we-check", "/emergency", "/report"];

export function BottomBar() {
  const pathname = usePathname();

  // First open (screen 7) is full screen, and sub-pages with a back arrow have no bar (screens 3, 6, 14).
  if (pathname === "/" || HIDDEN_UNDER.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <>
      {/* Keeps page content clear of the fixed bar. */}
      <div aria-hidden="true" className="h-[calc(3.5rem+env(safe-area-inset-bottom))]" />
      <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  active ? "text-brand" : "text-ink/60"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
      </nav>
    </>
  );
}
