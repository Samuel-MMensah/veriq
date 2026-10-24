// Insurer views (screens 18 and 19). Mobile first (rule 7), widening on a desk computer.
export default function InsurerLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh max-w-5xl bg-page">{children}</div>;
}
