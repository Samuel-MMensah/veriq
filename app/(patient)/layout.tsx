import { BottomBar } from "@/components/nav/BottomBar";

// Patient layout: designed at 390 px (rule 7), with room above the bottom bar.
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-white pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      {children}
      <BottomBar />
    </div>
  );
}
