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
    return <p className="rounded-2xl bg-page p-4 text-ink/80">Your last search will show here, so you can run it again in one tap.</p>;
  }
  const area = AREAS.find((a) => a.slug === query.get("area"));
  return (
    <Link href={`/results?${query}`} className="block rounded-2xl border border-ink/15 bg-white p-4">
      <span className="block text-sm font-semibold text-ink/70">Your last search</span>
      <span className="mt-1 block text-lg font-bold">
        {service.label} · {card === CASH ? "No card / cash" : cardName(card)} · near {area?.name ?? "you"}
      </span>
      <span className="mt-1 block font-bold text-brand">Search again</span>
    </Link>
  );
}
