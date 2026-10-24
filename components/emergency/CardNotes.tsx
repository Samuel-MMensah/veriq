"use client";

import { useEffect, useState } from "react";
import { listCards } from "@/lib/local/cards";
import type { BadgeId } from "@/lib/rules/badge";
import { cardNote } from "@/lib/view/emergency";

/**
 * Screen 6: what the person's saved cards mean at this hospital. Information only (rules 3 and S2):
 * the list and its order were fixed on the server without any card.
 */
export function CardNote({ cardBadges, names }: { cardBadges: Record<string, BadgeId>; names: Record<string, string> }) {
  const [slugs, setSlugs] = useState<string[] | null>(null);

  useEffect(() => {
    listCards()
      .then((cards) => setSlugs([...new Set(cards.map((c) => c.insurerSlug))]))
      .catch(() => setSlugs([]));
  }, []);

  const note = slugs ? cardNote(cardBadges, slugs, names) : null;
  if (!note) return null;
  return <p className="mt-3 text-sm text-ink/80">{note}</p>;
}
