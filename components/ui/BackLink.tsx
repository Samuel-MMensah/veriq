"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

/** Goes back when there is a page to go back to; otherwise to `fallback`. Works without JavaScript too. */
export function BackLink({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      aria-label={label}
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-ink/5"
    >
      <Icon name="back" className="h-6 w-6" />
    </Link>
  );
}
