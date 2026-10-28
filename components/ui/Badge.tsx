import { cx } from "./cx";

/** Red is for emergency mode only (Prompt 10c), so badges have no red tone. */
export type Tone = "neutral" | "good" | "brand" | "warn";

const TONE: Record<Tone, string> = {
  neutral: "bg-neutral-bg text-neutral-ink",
  good: "bg-good-bg text-good-ink",
  brand: "bg-brand text-white",
  warn: "bg-warn-bg text-warn-ink",
};

/** A small label for a state, in words ("Verified", "Held", "Switched off"). Never colour alone. */
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-small font-semibold whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
