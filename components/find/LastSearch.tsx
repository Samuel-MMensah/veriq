"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLastSearch } from "@/lib/local/prefs";
import { AREAS, CASH, SERVICE_CHIPS, cardName } from "@/lib/view/catalog";

/** The last search on this phone (rule 8), one tap to run again. Read from localStorage only. */
export function LastSearch() {
  const [query, setQuery] = useState<URLSearchParams | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(getLastSearch());
  }, []);

  const service = SERVICE_CHIPS.find((c) => c.slug === query?.get("service"));
  const card = query?.get("card");
  if (!query || !service || !card) {
    return <p className="rounded-(--radius-card) bg-page p-4 text-muted">Your last search will show here, so you can run it again in one tap.</p>;
  }
  const area = AREAS.find((a) => a.slug === query.get("area"));
  return (
    <Link href={`/results?${query}`} className="block rounded-(--radius-card) border border-line-strong bg-surface p-4">
      <span className="block text-sm font-semibold text-muted">Your last search</span>
      <span className="mt-1 block text-lg font-bold">
        {service.label} · {card === CASH ? "No card / cash" : cardName(card)} · near {area?.name ?? "you"}
      </span>
      <span className="mt-1 block font-bold text-brand">Search again</span>
    </Link>
  );
}
