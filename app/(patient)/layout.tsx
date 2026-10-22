import { BottomBar } from "@/components/nav/BottomBar";
import { QueueFlusher } from "@/components/report/QueueFlusher";

// Patient layout: designed at 390 px (rule 7). The bottom bar adds its own spacer where it shows.
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-white">
      {children}
      <BottomBar />
      <QueueFlusher />
    </div>
  );
}
