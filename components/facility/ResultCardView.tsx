import Link from "next/link";
import { BadgeLine } from "@/components/badges/BadgeLine";
import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { ResultCard, UnlistedCard } from "@/lib/view/results";
import { StatusLine } from "./StatusLine";

/**
 * One hospital in the results, in the order a patient decides: will they take my card (rule B),
 * is it open today (rule F), will I pay extra (rule T), how far is it.
 * The card is a box holding the link and, beside it, the Call button, so a button never sits inside
 * a link.
 */
export function ResultCardView({
  card,
  href,
  cardName,
  index = 0,
}: {
  card: ResultCard;
  href: string;
  /** null for "No card/cash". */
  cardName: string | null;
  /** Position in the list: cards arrive one after another, briefly (none with reduced motion). */
  index?: number;
}) {
  const refused = card.badge?.id === "B1";
  return (
    <li
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
      className={`animate-enter rounded-(--radius-card) border bg-surface shadow-card ${refused ? "border-refused/40" : "border-transparent"}`}
    >
      <Link href={href} className="block rounded-(--radius-card) p-4 transition-colors hover:bg-brand-soft/40">
        <CardHead name={card.name} area={card.area} distanceKm={card.distanceKm} />
        {card.badge && cardName && (
          <div className="mt-3">
            <BadgeLine badge={card.badge} cardName={cardName} />
          </div>
        )}
        <div className="mt-3 space-y-1 leading-snug">
          <StatusLine label={card.serviceName} status={card.status} usualHours={card.usualHours} />
          {/* Rule T: only shown when patients reported one; no line for "nothing reported". */}
          {cardName && card.topUps.length > 0 && <p className="text-muted">{card.topUps.join(" · ")}</p>}
          {card.sourceLine && <p className="text-small text-muted">{card.sourceLine}</p>}
        </div>
      </Link>
      {/* Rule B4 says "Call first", so the card lets you call. */}
      {card.callFirst && <CallRow name={card.name} phone={card.phone} source={card.phoneSource} />}
    </li>
  );
}

/** Rule D3: a real facility with no services listed. The NHIA type as the file writes it, and for NHIS its badge. */
export function UnlistedCardView({ card, href, cardName }: { card: UnlistedCard; href: string; cardName: string | null }) {
  return (
    <li className="rounded-(--radius-card) border border-transparent bg-surface shadow-card">
      <Link href={href} className="block rounded-(--radius-card) p-4 transition-colors hover:bg-brand-soft/40">
        <CardHead name={card.name} area={card.area} distanceKm={card.distanceKm} />
        {card.nhiaType && (
          <p className="mt-1 text-small text-muted">
            NHIA type: <span className="font-semibold">{card.nhiaType}</span>
          </p>
        )}
        {card.badge && cardName && (
          <div className="mt-2">
            <BadgeLine badge={card.badge} cardName={cardName} />
          </div>
        )}
        {card.sourceLine && <p className="mt-2 text-small text-muted">{card.sourceLine}</p>}
      </Link>
      <CallRow name={card.name} phone={card.phone} source={card.phoneSource} />
    </li>
  );
}

function CardHead({ name, area, distanceKm }: { name: string; area: string | null; distanceKm: number }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-section">{name}</h2>
        <p className="text-small text-muted">
          {area && <>{area} · </>}
          <span className="font-semibold text-muted">{distanceKm} km</span>
        </p>
      </div>
      <Icon name="chevron" className="mt-1 h-5 w-5 text-brand" />
    </div>
  );
}

/** The Call button, or plainly no number: we never show a number the source doesn't have (rule D1). */
function CallRow({ name, phone, source }: { name: string; phone: string | null; source: string | null }) {
  return (
    <div className="border-t border-line px-4 py-2">
      {phone ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a href={`tel:${phone.replace(/\s/g, "")}`} aria-label={`Call ${name}`} className={buttonClass({ variant: "secondary" })}>
            <Icon name="phone" className="h-5 w-5" /> Call
          </a>
          {/* Rule 4: where the number came from, e.g. "Veriq call, 28 Oct 2026". */}
          {source && <span className="text-small text-muted">{source}</span>}
        </div>
      ) : (
        <p className="flex min-h-11 items-center text-small text-muted">No phone listed</p>
      )}
    </div>
  );
}
