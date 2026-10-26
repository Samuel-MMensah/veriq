import Link from "next/link";
import { BadgeLine } from "@/components/badges/BadgeLine";
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
}: {
  card: ResultCard;
  href: string;
  /** null for "No card/cash". */
  cardName: string | null;
}) {
  const refused = card.badge?.id === "B1";
  return (
    <li className={`rounded-2xl border bg-white shadow-sm ${refused ? "border-refused/40" : "border-transparent"}`}>
      <Link href={href} className="block rounded-2xl p-4 hover:bg-brand/[0.03]">
        <CardHead name={card.name} area={card.area} distanceKm={card.distanceKm} />
        {card.badge && cardName && (
          <div className="mt-2">
            <BadgeLine badge={card.badge} cardName={cardName} />
          </div>
        )}
        <div className="mt-2 space-y-1 text-[0.9375rem] leading-snug">
          <StatusLine label={card.serviceName} status={card.status} usualHours={card.usualHours} />
          {/* Rule T: only shown when patients reported one; no line for "nothing reported". */}
          {cardName && card.topUps.length > 0 && <p className="text-ink/80">{card.topUps.join(" · ")}</p>}
          {card.sourceLine && <p className="text-sm text-ink/70">{card.sourceLine}</p>}
        </div>
      </Link>
      {/* Rule B4 says "Call first", so the card lets you call. */}
      {card.callFirst && <CallRow name={card.name} phone={card.phone} />}
    </li>
  );
}

/** Rule D3: a real facility with no services listed. The NHIA type as the file writes it, and for NHIS its badge. */
export function UnlistedCardView({ card, href, cardName }: { card: UnlistedCard; href: string; cardName: string | null }) {
  return (
    <li className="rounded-2xl border border-transparent bg-white shadow-sm">
      <Link href={href} className="block rounded-2xl p-4 hover:bg-brand/[0.03]">
        <CardHead name={card.name} area={card.area} distanceKm={card.distanceKm} />
        {card.nhiaType && (
          <p className="mt-1 text-sm text-ink/80">
            Type on the NHIA list: <span className="font-semibold">{card.nhiaType}</span>
          </p>
        )}
        {card.badge && cardName && (
          <div className="mt-2">
            <BadgeLine badge={card.badge} cardName={cardName} />
          </div>
        )}
        {card.sourceLine && <p className="mt-2 text-sm text-ink/70">{card.sourceLine}</p>}
      </Link>
      <CallRow name={card.name} phone={card.phone} />
    </li>
  );
}

function CardHead({ name, area, distanceKm }: { name: string; area: string | null; distanceKm: number }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold leading-snug">{name}</h2>
        <p className="text-sm text-ink/70">
          {area && <>{area} · </>}
          <span className="font-semibold text-ink/80">{distanceKm} km</span>
        </p>
      </div>
      <Icon name="chevron" className="mt-1 h-5 w-5 text-brand" />
    </div>
  );
}

/** The Call button, or plainly no number: we never show a number the source doesn't have (rule D1). */
function CallRow({ name, phone }: { name: string; phone: string | null }) {
  return (
    <div className="border-t border-ink/10 px-4 py-2">
      {phone ? (
        <a
          href={`tel:${phone.replace(/\s/g, "")}`}
          aria-label={`Call ${name}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand px-4 font-bold text-brand"
        >
          <Icon name="phone" className="h-5 w-5" /> Call
        </a>
      ) : (
        <p className="flex min-h-11 items-center text-sm text-ink/70">No phone number on the list yet</p>
      )}
    </div>
  );
}
