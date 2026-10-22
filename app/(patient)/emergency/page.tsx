import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "Emergency mode" };

export default function Page() {
  return <ScreenPlaceholder title="Emergency mode" screen={6} prompt={6} sampleData />;
}
