import Link from "next/link";
import { BadgeLine } from "@/components/badges/BadgeLine";
import { HistoryTable } from "@/components/badges/HistoryTable";
import { Icon } from "@/components/ui/Icon";
import type { CardRow } from "@/lib/view/facility";

const ANSWER_STYLE: Record<CardRow["answer"], string> = {
  Yes: "bg-brand/10 text-brand",
  Unsure: "bg-ink/[0.06] text-ink/80",
  Refused: "bg-refused-bg text-refused-ink",
  No: "bg-ink/[0.06] text-ink/80",
  Unknown: "bg-ink/[0.06] text-ink/70",
};

function TopUps({ topUps }: { topUps: string[] }) {
  return topUps.map((t) => (
    <p key={t} className="mt-2 flex items-start gap-2 rounded-lg bg-page p-2 text-sm text-ink/80">
      <Icon name="info" className="mt-0.5 h-4 w-4" />
      {t}
    </p>
  ));
}

/** The card the person searched with: the answer (rule B), what patients said, and top-ups (rule T). */
export function YourCard({ card }: { card: CardRow }) {
  return (
    <section aria-labelledby="your-card" className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 id="your-card" className="text-lg font-bold">
          Your card here
        </h2>
        <Link href="/how-we-check" className="inline-flex min-h-11 items-center font-semibold text-brand underline">
          How we check
        </Link>
      </div>
      <BadgeLine badge={card.badge} cardName={card.insurer.name} />
      <HistoryTable history={card.badge.history} />
      <TopUps topUps={card.topUps} />
    </section>
  );
}

/** Every other card at this hospital: one answer and its source line each (rule 4), plus top-ups (rule T). */
export function CardsAccepted({ cards, title, howWeCheck }: { cards: CardRow[]; title: string; howWeCheck: boolean }) {
  if (cards.length === 0 && !howWeCheck) return null;
  return (
    <section aria-labelledby="cards" className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id="cards" className="text-lg font-bold">
          {title}
        </h2>
        {howWeCheck && (
          <Link href="/how-we-check" className="inline-flex min-h-11 items-center font-semibold text-brand underline">
            How we check
          </Link>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="mt-2 text-sm text-ink/70">No card information yet. Call first.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {cards.map((c) => (
            <li key={c.insurer.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold">{c.insurer.name}</h3>
                  {/* Rule 4: every fact says who said so and when. */}
                  <p className="text-sm text-ink/70">{c.badge.text}</p>
                </div>
                <span className={`shrink-0 rounded-lg px-3 py-1 text-sm font-bold ${ANSWER_STYLE[c.answer]}`}>
                  {c.answer}
                </span>
              </div>
              <TopUps topUps={c.topUps} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
