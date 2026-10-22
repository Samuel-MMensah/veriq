// Rule 1 (section 1): every screen with data shows a "SAMPLE DATA" tag until Phase 2.
export function SampleDataTag({ className = "" }: { className?: string }) {
  return (
    <span
      role="note"
      aria-label="Sample data: these are invented hospitals, not real ones"
      className={`inline-flex items-center rounded-lg bg-ink/[0.07] px-2.5 py-1 text-xs font-semibold tracking-wide text-ink/70 ${className}`}
    >
      SAMPLE DATA
    </span>
  );
}
