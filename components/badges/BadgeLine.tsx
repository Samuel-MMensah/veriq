import { Icon, type IconName } from "@/components/ui/Icon";
import { verdict, type Badge, type BadgeTone } from "@/lib/rules/badge";

// Prompt 10c colours: green for "confirmed" (hospital or patients, told apart by the icon), orange only
// for refusals, neutral for the rest.
const STYLE: Record<BadgeTone, { box: string; icon: IconName }> = {
  hospital: { box: "bg-brand-soft text-brand-strong", icon: "check" },
  patients: { box: "bg-brand-soft text-brand-strong", icon: "person" },
  unchecked: { box: "bg-neutral-bg text-neutral-ink", icon: "info" },
  refused: { box: "bg-warn-bg text-warn-ink", icon: "cross" },
  hospital_no: { box: "bg-neutral-bg text-neutral-ink", icon: "cross" },
  unknown: { box: "bg-neutral-bg text-neutral-ink", icon: "info" },
};

/**
 * The rule B badge as an answer first ("Takes NHIS"), then who said so and when (rule 4), in the
 * rule's own words. Icon and words carry the meaning, so it reads without colour too.
 */
export function BadgeLine({ badge, cardName }: { badge: Pick<Badge, "id" | "tone" | "text">; cardName: string }) {
  const style = STYLE[badge.tone];
  return (
    <p className={`flex items-start gap-2.5 rounded-(--radius-control) px-3 py-2.5 ${style.box}`}>
      <Icon name={style.icon} className="mt-1 h-4 w-4" />
      <span>
        <span className="block font-semibold">{verdict(badge.id, cardName).headline}</span>
        <span className="block text-small">{badge.text}</span>
      </span>
    </p>
  );
}

const LEGEND: { label: string; icon: IconName; tone: string }[] = [
  { label: "Hospital confirmed", icon: "check", tone: "text-brand" },
  { label: "Patients confirmed", icon: "person", tone: "text-brand" },
  { label: "Not checked yet", icon: "info", tone: "text-neutral-ink" },
  { label: "Reported refused", icon: "cross", tone: "text-warn-ink" },
];

/** Folded to one line: every badge already says its answer in words. */
export function BadgeLegend() {
  return (
    <details className="text-small text-muted">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-brand">What the colours mean</summary>
      <ul aria-label="What the badges mean" className="grid grid-cols-2 gap-x-3 gap-y-1 pb-1">
        {LEGEND.map((l) => (
          <li key={l.label} className="flex items-center gap-1.5">
            <Icon name={l.icon} className={`h-4 w-4 ${l.tone}`} />
            {l.label}
          </li>
        ))}
      </ul>
    </details>
  );
}
