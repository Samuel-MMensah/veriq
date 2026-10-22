import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "Results" };

export default function Page() {
  return <ScreenPlaceholder title="Results" screen={2} prompt={4} sampleData />;
}
