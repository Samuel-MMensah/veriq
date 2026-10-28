import type { Metadata } from "next";
import Link from "next/link";
import { LastSearch } from "@/components/find/LastSearch";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Saved" };

// Screen 9 (saved hospitals and alerts) is Phase 2 (Prompt 12). Until then the tab is not a dead
// end: it offers the last search this phone remembers (rule 8).
export default function Page() {
  return (
    <main className="px-4 pb-6 pt-6">
      <h1 className="text-title">Saved</h1>
      <div className="mt-6 space-y-3">
        <LastSearch />
        <Link href="/find" className={buttonClass({ variant: "secondary", full: true })}>
          New search
        </Link>
      </div>
    </main>
  );
}
