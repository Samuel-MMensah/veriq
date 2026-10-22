import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "How Veriq checks" };

export default function Page() {
  return <ScreenPlaceholder title="How Veriq checks" screen={14} prompt={4} />;
}
