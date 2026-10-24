import Link from "next/link";
import { BadgeLine } from "@/components/badges/BadgeLine";
import { Icon } from "@/components/ui/Icon";
import type { ResultCard } from "@/lib/view/results";
import { StatusLine } from "./StatusLine";

/**
 * One hospital in the results, in the order a patient decides: will they take my card (rule B),
 * is it open today (rule F), will I pay extra (rule T), how far is it.
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
    <li>
      <Link
        href={href}
        className={`block rounded-2xl border bg-white p-4 shadow-sm hover:border-brand/40 ${
          refused ? "border-refused/40" : "border-transparent"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-snug">{card.name}</h2>
            <p className="text-sm text-ink/70">
              {card.area} · <span className="font-semibold text-ink/80">{card.distanceKm} km</span>
            </p>
          </div>
          <Icon name="chevron" className="mt-1 h-5 w-5 text-brand" />
        </div>
        {card.badge && cardName && (
          <div className="mt-2">
            <BadgeLine badge={card.badge} cardName={cardName} />
          </div>
        )}
        <div className="mt-2 space-y-1 text-[0.9375rem] leading-snug">
          <StatusLine label={card.serviceName} status={card.status} usualHours={card.usualHours} />
          {/* Rule T: only shown when patients reported one; no line for "nothing reported". */}
          {cardName && card.topUps.length > 0 && <p className="text-ink/80">{card.topUps.join(" · ")}</p>}
        </div>
      </Link>
    </li>
  );
}
