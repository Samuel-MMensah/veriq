import type { Metadata } from "next";
import { BackLink } from "@/components/ui/BackLink";
import { Icon, type IconName } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "How Veriq checks" };

// Screen 14: the one place that explains (Prompt 10c moves the explanations here). The words follow
// rules B (with B-V), F, S1, S2 and D3 in lib/rules and the team decisions in docs/DECISIONS.md.
const BADGES: { title: string; text: string; icon: IconName; tone: string }[] = [
  { title: "Hospital confirmed", text: "Their front desk confirmed it in the last 14 days.", icon: "check", tone: "bg-brand-soft text-brand-strong" },
  // rule B-V (Prompt 10b): one line, below the hospital's own answer and above patients.
  { title: "Veriq called", text: "Our team phoned them in the last 30 days and asked. A newer answer from the hospital wins.", icon: "phone", tone: "bg-brand-soft text-brand-strong" },
  {
    title: "Patients confirmed",
    text: "At least 3 patients said it worked in the last 30 days, and more said yes than no.",
    icon: "person",
    tone: "bg-brand-soft text-brand-strong",
  },
  { title: "On a list, not checked", text: "Only the NHIA or insurer list says so. Call first.", icon: "info", tone: "bg-neutral-bg text-neutral-ink" },
  {
    title: "Reported refused",
    text: "3 or more patients were turned away since the hospital last confirmed, and more than were served. This beats any list.",
    icon: "cross",
    tone: "bg-warn-bg text-warn-ink",
  },
];

const NOTES: { title: string; text: string }[] = [
  {
    title: "How results are sorted",
    text: "Strongest answer first, then today's status, then distance. Without a card: today's status, then distance. Places with no services listed come after, by distance; pharmacies aren't shown.",
  },
  {
    title: "Today's status ages",
    text: "Under 24 hours: shown as is. 1 to 3 days: \"may have changed\". Older: greyed out until the hospital checks in.",
  },
  {
    title: "Every number says its period",
    text: "Counts cover the last 7 days, 30 days or 12 months, and say which. Reports we hold back or reject are kept, never counted.",
  },
  {
    title: "Emergency mode",
    text: "Sorted by status and distance only. Your card never hides a hospital.",
  },
];

export default function HowWeCheckPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-page px-4 pb-8 pt-4">
      <div className="flex items-center gap-2">
        <BackLink fallback="/find" />
        <p className="text-muted">How Veriq checks</p>
      </div>

      <h1 className="mt-4 text-title">Every badge tells you who said so, and when.</h1>

      <ol className="mt-5 space-y-2">
        {BADGES.map((b) => (
          <li key={b.title} className="flex gap-3 rounded-(--radius-card) bg-surface p-4 shadow-card">
            <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${b.tone}`}>
              <Icon name={b.icon} className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-semibold">{b.title}</span>
              <span className="block text-small text-muted">{b.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 space-y-2">
        {NOTES.map((n) => (
          <section key={n.title} className="rounded-(--radius-card) bg-surface p-4 shadow-card">
            <h2 className="font-semibold">{n.title}</h2>
            <p className="mt-1 text-small text-muted">{n.text}</p>
          </section>
        ))}
      </div>

      <p className="mt-auto pt-8 text-small text-muted">
        Hospitals can&apos;t pay to change a badge. Paid partners get tools and reports, never a better rating.
      </p>
    </main>
  );
}
