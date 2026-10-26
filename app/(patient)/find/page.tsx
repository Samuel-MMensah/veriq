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
            <span className="text-brand">veriq</span> <span className="font-semibold text-ink/80">health</span>
          </p>
          <p className="mt-1 text-ink/70">Know before you go</p>
        </div>
      </header>

      <Link
        href="/emergency"
        className="mt-5 flex items-center gap-3 rounded-2xl bg-emergency-bg p-4 text-emergency"
      >
        <Icon name="alert" className="h-6 w-6" />
        <span className="flex-1">
          <span className="block font-bold">Emergency?</span>
          <span className="block">Open emergency mode. Your card won&apos;t hold you back.</span>
        </span>
        <Icon name="chevron" className="h-5 w-5" />
      </Link>

      <div className="mt-6">
        <FindForm />
      </div>
    </main>
  );
}
