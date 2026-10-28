// Prompt 10b, item 4: what the verification calls found, per card. This number goes on the pitch
// slide, so the counting is plain and tested: each facility counts once per card, with its newest
// call's answer; "not asked" doesn't count.
import type { CallAnswer, InsurerKind, ListedBy } from "@/lib/db/types";

export type SummaryCall = { id: string; facility_id: string; called_at: string };
export type SummaryAnswer = { call_id: string; insurer_id: string; answer: CallAnswer };
export type SummaryLink = { facility_id: string; insurer_id: string; listed_by: ListedBy };
export type SummaryInsurer = { id: string; name: string; slug: string; kind: InsurerKind };

export type CardSummary = {
  insurerId: string;
  card: string;
  slug: string;
  /** Facilities asked about this card (newest answer per facility). */
  called: number;
  accepts: number;
  partial: number;
  doesNot: number;
  /** The call agreed with the official list: listed and accepts (or partial), or not listed and does not. */
  matched: number;
  /** On the official list, but the facility said it does not accept the card. */
  listedButRefuses: number;
  /** Not on the official list, but the facility said it accepts the card (or partly). */
  notListedButAccepts: number;
};

export type CallSummary = {
  calls: number;
  facilities: number;
  /** ISO times of the first and last call, or null with no calls. */
  from: string | null;
  to: string | null;
  cards: CardSummary[];
};

/**
 * The official list for a card: for NHIS the NHIA list (NHIA keeps the NHIS list) or an insurer
 * list; for a private insurer only its own list (the same reading as rule K).
 */
export function onOfficialList(listedBy: ListedBy | undefined, kind: InsurerKind): boolean {
  if (listedBy === "insurer") return true;
  return kind === "public" && listedBy === "nhia";
}

export function summarizeCalls({
  calls,
  answers,
  links,
  insurers,
}: {
  calls: SummaryCall[];
  answers: SummaryAnswer[];
  links: SummaryLink[];
  insurers: SummaryInsurer[];
}): CallSummary {
  const callById = new Map(calls.map((c) => [c.id, c]));
  const listed = new Map(links.map((l) => [`${l.facility_id}|${l.insurer_id}`, l.listed_by]));
  // Newest call first, so the first answer seen per facility and card is the one that counts.
  const newestFirst = (a: SummaryCall, b: SummaryCall) => b.called_at.localeCompare(a.called_at) || b.id.localeCompare(a.id);

  const cards = [...insurers]
    // NHIS first, then the private cards by name.
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "public" ? -1 : 1))
    .map((insurer): CardSummary => {
      const latest = new Map<string, CallAnswer>();
      answers
        .filter((a) => a.insurer_id === insurer.id && a.answer !== "not_asked" && callById.has(a.call_id))
        .map((a) => ({ a, call: callById.get(a.call_id)! }))
        .sort((x, y) => newestFirst(x.call, y.call))
        .forEach(({ a, call }) => {
          if (!latest.has(call.facility_id)) latest.set(call.facility_id, a.answer);
        });
      const row: CardSummary = {
        insurerId: insurer.id,
        card: insurer.name,
        slug: insurer.slug,
        called: latest.size,
        accepts: 0,
        partial: 0,
        doesNot: 0,
        matched: 0,
        listedButRefuses: 0,
        notListedButAccepts: 0,
      };
      for (const [facilityId, answer] of latest) {
        const listedHere = onOfficialList(listed.get(`${facilityId}|${insurer.id}`), insurer.kind);
        const yes = answer === "accepts" || answer === "partial";
        if (answer === "accepts") row.accepts++;
        if (answer === "partial") row.partial++;
        if (answer === "does_not") row.doesNot++;
        if (listedHere === yes) row.matched++;
        else if (listedHere) row.listedButRefuses++;
        else row.notListedButAccepts++;
      }
      return row;
    });

  const times = calls.map((c) => c.called_at).sort();
  return {
    calls: calls.length,
    facilities: new Set(calls.map((c) => c.facility_id)).size,
    from: times[0] ?? null,
    to: times.at(-1) ?? null,
    cards,
  };
}

const CSV_HEADER = [
  "card",
  "facilities_called",
  "matched_official_list",
  "listed_but_refuses",
  "not_listed_but_accepts",
  "accepts",
  "partial",
  "does_not_accept",
  "first_call",
  "last_call",
];

const csvCell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** The summary as CSV, one row per card, with the date range on every row. */
export function summaryCsv(s: CallSummary): string {
  const lines = [CSV_HEADER.join(",")];
  for (const c of s.cards) {
    lines.push(
      [c.card, c.called, c.matched, c.listedButRefuses, c.notListedButAccepts, c.accepts, c.partial, c.doesNot, s.from ?? "", s.to ?? ""]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
