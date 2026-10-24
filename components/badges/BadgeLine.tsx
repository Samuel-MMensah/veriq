import { Icon, type IconName } from "@/components/ui/Icon";
import { verdict, type Badge, type BadgeTone } from "@/lib/rules/badge";

const STYLE: Record<BadgeTone, { box: string; icon: IconName }> = {
  hospital: { box: "bg-brand/10 text-brand", icon: "check" },
  patients: { box: "bg-patient/15 text-patient-ink", icon: "person" },
  unchecked: { box: "bg-ink/[0.06] text-ink/80", icon: "info" },
  refused: { box: "bg-refused-bg text-refused-ink", icon: "cross" },
  hospital_no: { box: "bg-ink/[0.06] text-ink/80", icon: "cross" },
  unknown: { box: "bg-ink/[0.06] text-ink/70", icon: "info" },
};

/**
 * The rule B badge as an answer first ("Takes NHIS"), then who said so and when (rule 4).
 * Colour, icon and words all carry the meaning, so it reads without colour too.
 */
export function BadgeLine({ badge, cardName }: { badge: Badge; cardName: string }) {
  const style = STYLE[badge.tone];
  return (
    <p className={`flex items-start gap-2 rounded-lg px-3 py-2 ${style.box}`}>
      <Icon name={style.icon} className="mt-1 h-4 w-4" />
      <span>
        <span className="block font-bold">{verdict(badge.id, cardName).headline}</span>
        <span className="block text-sm font-medium">{badge.text}</span>
      </span>
    </p>
  );
}

const LEGEND: { label: string; dot: string }[] = [
  { label: "Hospital confirmed", dot: "rounded-full bg-brand" },
  { label: "Patients confirmed", dot: "rounded-full bg-patient" },
  { label: "Not checked yet", dot: "rounded-full bg-ink/40" },
  { label: "Reported refused", dot: "rounded-sm bg-refused" },
];

/** Folded to one line: every badge already says its answer in words, so the colours are a reminder. */
export function BadgeLegend() {
  return (
    <details className="text-sm text-ink/80">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-brand">What the colours mean</summary>
      <ul aria-label="What the badges mean" className="grid grid-cols-2 gap-x-3 gap-y-1 pb-1">
        {LEGEND.map((l) => (
          <li key={l.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`inline-block h-3 w-3 ${l.dot}`} />
            {l.label}
          </li>
        ))}
      </ul>
    </details>
  );
}
