"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";
import { Icon, type IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName };

/** A link is current on its own page and below it; the first (home) link only on its own page. */
const isActive = (path: string, href: string, home: string) => (href === home ? path === home : path.startsWith(href));

/** Side navigation on a laptop; a row of tabs that scrolls on its own at 390 px. */
export function StaffNav({ items, layout, label }: { items: NavItem[]; layout: "side" | "tabs"; label: string }) {
  const path = usePathname();
  const home = items[0]?.href ?? "/";
  // "Admin" keeps the name the admin pages and tests already use.
  const name = label === "admin" ? "Admin" : `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  if (layout === "tabs") {
    return (
      <nav aria-label={name} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1 pb-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(path, item.href, home) ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center rounded-full px-3.5 text-small font-semibold whitespace-nowrap transition-colors",
                  isActive(path, item.href, home) ? "bg-white text-ink" : "text-white/80 hover:bg-white/10",
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
    <nav aria-label={name}>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(path, item.href, home) ? "page" : undefined}
              className={cx(
                "flex min-h-11 items-center gap-3 rounded-(--radius-control) px-3 font-semibold transition-colors",
                isActive(path, item.href, home) ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white",
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
