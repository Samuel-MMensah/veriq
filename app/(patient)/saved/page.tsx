import type { Metadata } from "next";
import Link from "next/link";
import { LastSearch } from "@/components/find/LastSearch";

export const metadata: Metadata = { title: "Saved" };

// Screen 9 (saved hospitals and alerts) is Phase 2 (Prompt 12). Until then the tab is not a dead
// end: it offers the last search this phone remembers (rule 8).
export default function Page() {
  return (
    <main className="px-4 pb-6 pt-6">
      <h1 className="text-3xl font-extrabold">Saved</h1>
      <p className="mt-1 text-muted">Saving hospitals and alerts come in the pilot.</p>
      <div className="mt-6 space-y-3">
        <LastSearch />
        <Link
          href="/find"
          className="flex min-h-14 items-center justify-center rounded-(--radius-card) border-2 border-brand font-bold text-brand"
        >
          Start a new search
        </Link>
      </div>
    </main>
  );
}
