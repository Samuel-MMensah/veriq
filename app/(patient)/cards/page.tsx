import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "My cards" };

export default function Page() {
  return <ScreenPlaceholder title="My cards" screen={5} prompt={6} />;
}
