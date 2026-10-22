import { Icon, type IconName } from "@/components/ui/Icon";
import type { Badge, BadgeTone } from "@/lib/rules/badge";

const STYLE: Record<BadgeTone, { box: string; icon: IconName }> = {
  hospital: { box: "bg-brand/10 text-brand", icon: "check" },
  patients: { box: "bg-patient/15 text-patient-ink", icon: "person" },
  unchecked: { box: "bg-ink/[0.06] text-ink/80", icon: "info" },
  refused: { box: "bg-refused-bg text-refused-ink", icon: "cross" },
  hospital_no: { box: "bg-ink/[0.06] text-ink/80", icon: "cross" },
  unknown: { box: "bg-ink/[0.06] text-ink/70", icon: "info" },
};

/** The rule B badge with its own words, prefixed by the card it is about. */
export function BadgeLine({ badge, cardName }: { badge: Badge; cardName: string }) {
  const style = STYLE[badge.tone];
  return (
    <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${style.box}`}>
      <Icon name={style.icon} className="mt-0.5 h-4 w-4" />
      <span>
        {cardName} · {badge.text}
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

export function BadgeLegend() {
  return (
    <ul aria-label="What the badges mean" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/80">
      {LEGEND.map((l) => (
        <li key={l.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block h-3 w-3 ${l.dot}`} />
          {l.label}
        </li>
      ))}
    </ul>
  );
}
