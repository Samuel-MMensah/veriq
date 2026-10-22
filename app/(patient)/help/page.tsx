import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ui/ScreenPlaceholder";

export const metadata: Metadata = { title: "Help: USSD and SMS" };

export default function Page() {
  return <ScreenPlaceholder title="Help: USSD and SMS" screen={13} prompt={6} />;
}
