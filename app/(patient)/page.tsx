import type { Metadata } from "next";
import { Welcome } from "@/components/welcome/Welcome";

export const metadata: Metadata = { title: "Know before you go" };

// Screen 7, first open. Shown once (remembered on the phone), then "/" goes to /find.
export default function FirstOpenPage() {
  return <Welcome />;
}
