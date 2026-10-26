"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";
import { Icon, type IconName } from "@/components/ui/Icon";

export const ADMIN_NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Overview", icon: "home" },
  { href: "/admin/hospitals", label: "Hospitals", icon: "shield" },
  { href: "/admin/reports", label: "Held reports", icon: "flag" },
  { href: "/admin/locations", label: "Locations", icon: "pin" },
  { href: "/admin/staff", label: "Staff accounts", icon: "people" },
  { href: "/admin/demo", label: "Demo data", icon: "beaker" },
];

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

/** Side navigation on a laptop; a row of tabs that scrolls on its own at 390 px. */
export function AdminNav({ layout }: { layout: "side" | "tabs" }) {
  const path = usePathname();
  if (layout === "tabs") {
    return (
      <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1 pb-1">
          {ADMIN_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(path, item.href) ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
                  isActive(path, item.href) ? "bg-white text-ink" : "text-white/80 hover:bg-white/10",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }
  return (
    <nav aria-label="Admin">
      <ul className="space-y-0.5">
        {ADMIN_NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(path, item.href) ? "page" : undefined}
              className={cx(
                "flex min-h-11 items-center gap-3 rounded-(--radius-control) px-3 font-semibold transition-colors",
                isActive(path, item.href) ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
