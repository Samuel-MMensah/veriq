import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "After a report" };

export default function Page() {
  return <ScreenPlaceholder title="After a report" screen={11} prompt={5} sampleData />;
}
