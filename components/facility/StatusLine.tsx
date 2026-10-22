import type { StatusTone, StatusView } from "@/lib/view/status";

export const TONE_TEXT: Record<StatusTone, string> = {
  good: "text-brand",
  later: "text-refused-ink",
  bad: "text-emergency",
  unknown: "text-ink/70",
};

/** "Antenatal clinic: Open till 4 pm · updated by hospital 40 min ago", with rule F warnings. */
export function StatusLine({ label, status, usualHours }: { label: string; status: StatusView; usualHours: string | null }) {
  const { freshness } = status;
  return (
    <p className={freshness.greyed ? "text-ink/50" : "text-ink/80"}>
      {label}:{" "}
      <span className={`font-semibold ${freshness.greyed ? "" : TONE_TEXT[status.tone]}`}>{status.word}</span>
      {status.sourceText && <> · {status.sourceText}</>}
      {freshness.state !== "fresh" && freshness.state !== "none" && freshness.warning && (
        <> · <span className="font-medium">{freshness.warning}</span></>
      )}
      {freshness.state === "none" && usualHours && <> · usually {usualHours}</>}
    </p>
  );
}
