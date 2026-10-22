import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "First open" };

export default function Page() {
  return <ScreenPlaceholder title="First open" screen={7} prompt={4} />;
}
