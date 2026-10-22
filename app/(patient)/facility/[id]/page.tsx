import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "Hospital detail" };

export default function Page() {
  return <ScreenPlaceholder title="Hospital detail" screen={3} prompt={4} sampleData />;
}
