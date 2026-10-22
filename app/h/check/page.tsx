import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "Hospital morning check" };

export default function Page() {
  return <ScreenPlaceholder title="Hospital morning check" screen={16} prompt={7} sampleData />;
}
