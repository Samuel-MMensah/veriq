"use client";

import { useEffect, useState } from "react";
import { listCards } from "@/lib/local/cards";
import { getLastCard } from "@/lib/local/prefs";
import { CASH } from "@/lib/view/catalog";
import type { BadgeId } from "@/lib/rules/badge";
import { cardNote } from "@/lib/view/emergency";

/**
 * Screen 6: what the person's saved cards mean at this hospital. Information only (rules 3 and S2):
 * the list and its order were fixed on the server without any card.
 */
export function CardNote({ cardBadges, names }: { cardBadges: Record<string, BadgeId>; names: Record<string, string> }) {
  const [slugs, setSlugs] = useState<string[] | null>(null);

  useEffect(() => {
    // Saved cards; if none, the card last searched with (not "No card/cash").
    const lastSearched = () => {
      const last = getLastCard();
      return last && last !== CASH ? [last] : [];
    };
    listCards()
      .then((cards) => setSlugs(cards.length ? [...new Set(cards.map((c) => c.insurerSlug))] : lastSearched()))
      .catch(() => setSlugs(lastSearched()));
  }, []);

  const note = slugs ? cardNote(cardBadges, slugs, names) : null;
  if (!note) return null;
  return <p className="mt-3 text-small text-muted">{note}</p>;
}
