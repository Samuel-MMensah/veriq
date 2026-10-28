import type { Metadata } from "next";
import Link from "next/link";
import { FindForm } from "@/components/find/FindForm";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Find care" };

export default function FindPage() {
  return (
    <main className="px-4 pb-6 pt-6">
      <header>
        <h1 className="sr-only">Find care</h1>
        <p aria-hidden="true" className="text-title text-brand">
          veriq <span className="font-semibold text-muted">health</span>
        </p>
      </header>

      {/* One line, always first. Red means emergency and nothing else (Prompt 10c). */}
      <Link
        href="/emergency"
        className="mt-4 flex min-h-12 items-center gap-2 rounded-(--radius-control) bg-danger-bg px-4 font-semibold text-danger-ink transition-colors hover:bg-[#fbe1de]"
      >
        <Icon name="alert" className="h-5 w-5" />
        <span className="min-w-0 flex-1">Emergency? Get help now</span>
        <Icon name="chevron" className="h-5 w-5" />
      </Link>

      <div className="mt-6">
        <FindForm />
      </div>
    </main>
  );
}
