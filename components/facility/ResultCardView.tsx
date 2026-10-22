import Link from "next/link";
import { BadgeLine } from "@/components/badges/BadgeLine";
import type { ResultCard } from "@/lib/view/results";
import { StatusLine } from "./StatusLine";

export function ResultCardView({
  card,
  href,
  cardName,
  serviceName,
}: {
  card: ResultCard;
  href: string;
  /** null for "No card/cash". */
  cardName: string | null;
  serviceName: string;
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
          <h2 className="text-lg font-bold leading-snug">{card.name}</h2>
          <span className="shrink-0 pt-0.5 text-sm text-ink/70">{card.distanceKm} km</span>
        </div>
        {card.badge && cardName && (
          <div className="mt-2">
            <BadgeLine badge={card.badge} cardName={cardName} />
          </div>
        )}
        <div className="mt-2 space-y-1 text-sm">
          <StatusLine label={serviceName} status={card.status} usualHours={card.usualHours} />
          {cardName && (
            <p className="text-ink/80">{card.topUps.length ? card.topUps.join(" · ") : "No top-up reported"}</p>
          )}
        </div>
      </Link>
    </li>
  );
}
