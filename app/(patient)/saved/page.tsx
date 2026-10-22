import type { Metadata } from "next";

export const metadata: Metadata = { title: "Saved" };

// Screen 9 is Phase 2 (Prompt 12). Until then this tab only explains that.
export default function Page() {
  return (
    <main className="px-4 pt-6 pb-4">
      <h1 className="text-2xl font-extrabold">Saved</h1>
      <p className="mt-2 text-sm text-ink/70">Saving hospitals is coming in the pilot.</p>
    </main>
  );
}
