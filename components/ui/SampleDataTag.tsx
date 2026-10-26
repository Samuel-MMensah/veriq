// Rule 1 (section 1): every screen with data shows a "SAMPLE DATA" tag until Phase 2.
export function SampleDataTag({ className = "", onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span
      role="note"
      aria-label="Sample data: these are invented hospitals, not real ones"
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wide ${
        onDark ? "bg-white/15 text-white" : "bg-ink/[0.07] text-muted"
      } ${className}`}
    >
      SAMPLE DATA
    </span>
  );
}
