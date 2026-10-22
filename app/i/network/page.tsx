import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "Insurer network health" };

export default function Page() {
  return <ScreenPlaceholder title="Insurer network health" screen={18} prompt={7} sampleData />;
}
