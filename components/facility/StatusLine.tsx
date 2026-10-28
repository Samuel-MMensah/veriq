import type { StatusTone, StatusView } from "@/lib/view/status";

// Prompt 10c: green for good, orange for warnings ("Closed", "Full"), ink for "From 2 pm". Red is
// for emergency mode only.
export const TONE_TEXT: Record<StatusTone, string> = {
  good: "text-brand",
  later: "text-ink",
  bad: "text-warn-ink",
  unknown: "text-muted",
};

/** "Antenatal clinic: Open till 4 pm · Hospital · 40 min ago", with rule F warnings. */
export function StatusLine({ label, status, usualHours }: { label: string; status: StatusView; usualHours: string | null }) {
  const { freshness } = status;
  return (
    <p className={freshness.greyed ? "text-ink/50" : "text-muted"}>
      {label}:{" "}
      <span className={`font-semibold ${freshness.greyed ? "" : TONE_TEXT[status.tone]}`}>{status.word}</span>
      {status.sourceText && <> · {status.sourceText}</>}
      {freshness.state !== "fresh" && freshness.state !== "none" && freshness.warning && (
        <> · <span className="font-semibold">{freshness.warning}</span></>
      )}
      {freshness.state === "none" && usualHours && <> · usually {usualHours}</>}
    </p>
  );
}
