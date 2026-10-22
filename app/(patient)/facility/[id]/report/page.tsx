import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "Was your card accepted?" };

export default function Page() {
  return <ScreenPlaceholder title="Was your card accepted?" screen={4} prompt={5} sampleData />;
}
