import type { Metadata } from "next";
import { CardsManager } from "@/components/cards/CardsManager";

export const metadata: Metadata = { title: "My cards" };

// Screen 5. The cards are read from this phone (IndexedDB) by CardsManager; nothing comes from the server.
export default function CardsPage() {
  return (
    <main className="px-4 pb-6 pt-6">
      <h1 className="text-3xl font-extrabold">My cards</h1>
      <p className="mt-1 text-ink/70">Saved on this phone only</p>
      <CardsManager />
    </main>
  );
}
