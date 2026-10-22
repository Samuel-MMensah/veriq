import type { Metadata } from "next";
import { BackLink } from "@/components/ui/BackLink";

export const metadata: Metadata = { title: "How Veriq checks" };

// Screen 14. The words follow rules B and F in lib/rules (and the team decision of 2026-10-22).
const BADGES = [
  {
    n: "1",
    title: "Hospital confirmed",
    text: "Their front desk confirmed it in the last 14 days.",
    box: "bg-brand/10 text-brand",
    dot: "bg-brand text-white",
  },
  {
    n: "2",
    title: "Patients confirmed",
    text: "At least 3 patients said it worked in the last 30 days, and more said yes than no.",
    box: "bg-patient/15 text-patient-ink",
    dot: "bg-patient text-ink",
  },
  {
    n: "3",
    title: "On a list, not checked",
    text: "Only the NHIA or insurer list says so. Call first.",
    box: "bg-ink/[0.05] text-ink",
    dot: "bg-ink/60 text-white",
  },
  {
    n: "!",
    title: "Reported refused",
    text: "3 or more patients were turned away since the hospital last confirmed, and more were turned away than served. This beats any list.",
    box: "bg-refused-bg text-refused-ink",
    dot: "bg-refused text-white",
  },
];

export default function HowWeCheckPage() {
  return (
    <main className="flex min-h-dvh flex-col px-4 pb-8 pt-4">
      <div className="flex items-center gap-2">
        <BackLink fallback="/find" />
        <p className="text-lg text-ink/70">How Veriq checks</p>
      </div>

      <h1 className="mt-4 text-3xl font-extrabold leading-tight">Every badge tells you who said so, and when.</h1>
      <p className="mt-2 text-lg text-ink/80">We never just copy a list. Strongest first:</p>

      <ol className="mt-5 space-y-3">
        {BADGES.map((b) => (
          <li key={b.title} className={`flex gap-4 rounded-2xl p-4 ${b.box}`}>
            <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold ${b.dot}`}>
              {b.n}
            </span>
            <span>
              <span className="block text-lg font-bold">{b.title}</span>
              <span className="block">{b.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <section className="mt-4 rounded-2xl border border-ink/15 p-4">
        <h2 className="font-bold">Today&apos;s status ages too</h2>
        <p className="mt-1 text-ink/80">
          Under 24 hours: shown normally. 1 to 3 days: marked &quot;may have changed&quot;. Older: greyed out until the
          hospital checks in.
        </p>
      </section>

      <section className="mt-3 rounded-2xl border border-ink/15 p-4">
        <h2 className="font-bold">Every number says its period</h2>
        <p className="mt-1 text-ink/80">
          Counts always say if they cover the last 7 days, the last 30 days or the last 12 months. We keep the history.
          Reports we hold back or reject are kept, but never counted.
        </p>
      </section>

      <p className="mt-auto pt-10 text-ink/80">
        Hospitals can&apos;t pay to change a badge. Paid partners get tools and reports, never a better rating.
      </p>
    </main>
  );
}
