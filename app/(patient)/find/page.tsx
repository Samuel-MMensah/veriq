import type { Metadata } from "next";
import Link from "next/link";
import { FindForm } from "@/components/find/FindForm";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Find care" };

export default function FindPage() {
  return (
    <main className="px-4 pb-6 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="sr-only">Find care</h1>
          <p aria-hidden="true" className="text-3xl font-extrabold leading-none tracking-tight">
            <span className="text-brand">veriq</span> <span className="font-semibold text-muted">health</span>
          </p>
          <p className="mt-1 text-muted">Know before you go</p>
        </div>
      </header>

      <Link
        href="/emergency"
        className="mt-5 flex min-h-16 items-center gap-3 rounded-(--radius-card) bg-danger-bg px-4 py-3 text-danger-ink transition-colors hover:bg-[#fbe1de]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface">
          <Icon name="alert" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Emergency?</span>{" "}
          <span className="block text-sm">Open emergency mode. Your card won&apos;t hold you back.</span>
        </span>
        <Icon name="chevron" className="h-5 w-5" />
      </Link>

      <div className="mt-6">
        <FindForm />
      </div>
    </main>
  );
}
