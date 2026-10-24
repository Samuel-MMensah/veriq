// Hospital staff views (screens 15 to 17), designed at 390 px like the patient side (rule 7).
export default function HospitalLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh max-w-md bg-page">{children}</div>;
}
