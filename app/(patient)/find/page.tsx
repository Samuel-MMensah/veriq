import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "Find care" };

export default function Page() {
  return <ScreenPlaceholder title="Find care" screen={1} prompt={4} sampleData />;
}
