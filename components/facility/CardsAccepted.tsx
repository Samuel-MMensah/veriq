import Link from "next/link";
import { BadgeLine } from "@/components/badges/BadgeLine";
import { HistoryTable } from "@/components/badges/HistoryTable";
import type { CardRow } from "@/lib/view/facility";

const ANSWER_STYLE: Record<CardRow["answer"], string> = {
  Yes: "bg-good-bg text-good-ink",
  Unsure: "bg-neutral-bg text-neutral-ink",
  Refused: "bg-warn-bg text-warn-ink",
  No: "bg-neutral-bg text-neutral-ink",
  Unknown: "bg-neutral-bg text-neutral-ink",
};

/** Rule T top-ups, in the rule's own words, as a plain line. */
function TopUps({ topUps }: { topUps: string[] }) {
  return topUps.map((t) => (
    <p key={t} className="mt-2 text-small text-ink">
      {t}
    </p>
  ));
}

/** The card the person searched with: the answer (rule B), what patients said, and top-ups (rule T). */
export function YourCard({ card }: { card: CardRow }) {
  return (
    <section aria-labelledby="your-card" className="rounded-(--radius-card) bg-surface p-4 shadow-card">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id="your-card" className="text-section">
          Your card here
        </h2>
        <Link href="/how-we-check" className="inline-flex min-h-11 items-center text-small font-semibold text-brand">
          How we check
        </Link>
      </div>
      <div className="mt-1">
        <BadgeLine badge={card.badge} cardName={card.insurer.name} />
      </div>
      <HistoryTable history={card.badge.history} />
      <TopUps topUps={card.topUps} />
    </section>
  );
}

/** Every other card at this hospital: one answer and its source line each (rule 4), plus top-ups (rule T). */
export function CardsAccepted({ cards, title, howWeCheck }: { cards: CardRow[]; title: string; howWeCheck: boolean }) {
  if (cards.length === 0 && !howWeCheck) return null;
  return (
    <section aria-labelledby="cards" className="rounded-(--radius-card) bg-surface p-4 shadow-card">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 id="cards" className="text-section">
          {title}
        </h2>
        {howWeCheck && (
          <Link href="/how-we-check" className="inline-flex min-h-11 items-center text-small font-semibold text-brand">
            How we check
          </Link>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="mt-2 text-small text-muted">No card information yet. Call first.</p>
      ) : (
        <ul className="divide-y divide-line">
          {cards.map((c) => (
            <li key={c.insurer.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{c.insurer.name}</h3>
                  {/* Rule 4: every fact says who said so and when. */}
                  <p className="text-small text-muted">{c.badge.text}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-small font-semibold ${ANSWER_STYLE[c.answer]}`}>
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
