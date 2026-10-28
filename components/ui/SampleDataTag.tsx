// Rule 1: the "SAMPLE DATA" tag shows while a demo hospital is on the screen. One per screen, always
// at the top right of the page header, in this one style (Prompt 10c).
export function SampleDataTag({ className = "", onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span
      role="note"
      aria-label="Sample data: these are invented hospitals, not real ones"
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-small font-semibold tracking-wide ${
        onDark ? "bg-white/15 text-white" : "bg-neutral-bg text-neutral-ink"
      } ${className}`}
    >
      SAMPLE DATA
    </span>
  );
}
