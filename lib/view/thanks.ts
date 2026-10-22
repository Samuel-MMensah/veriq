// Screen 11: what the person's report changed on the hospital page, worked out with rules B and T
// on the hospital's reports with and without it.
import type { FacilityDetail } from "@/lib/db/queries";
import { badge } from "@/lib/rules/badge";
import { topUps } from "@/lib/rules/topup";

export type Change =
  /** The badge moved, e.g. from "On NHIA list" to "Listed, but 3 patients were refused". */
  | { kind: "badge"; headline: string; before: string }
  /** A top-up line appeared or changed. */
  | { kind: "topup"; headline: string; before: string | null }
  /** Nothing visible moved; the report is now part of the counts. */
  | { kind: "history"; headline: string }
  /** The report isn't showing (held for checking, or not found). */
  | { kind: "none" };

export function whatChanged({
  detail,
  insurerId,
  cardName,
  reportId,
  now,
}: {
  detail: FacilityDetail;
  insurerId: string;
  cardName: string;
  reportId: string;
  now: Date;
}): Change {
  const reports = detail.reports.filter((r) => r.insurer_id === insurerId);
  if (!reports.some((r) => r.id === reportId)) return { kind: "none" };
  const without = reports.filter((r) => r.id !== reportId);
  const link = detail.links.find((l) => l.insurer_id === insurerId) ?? null;
  const responses = detail.responses.filter((r) => r.insurer_id === insurerId);

  const before = badge({ link, reports: without, now });
  const after = badge({ link, reports, now });
  if (before.id !== after.id) {
    return { kind: "badge", headline: `${cardName} · ${after.text}`, before: `${cardName} · ${before.text}` };
  }

  const topBefore = topUps({ reports: without, responses, now });
  const topAfter = topUps({ reports, responses, now });
  const changed = topAfter.find((t) => topBefore.find((b) => b.item === t.item)?.text !== t.text);
  if (changed) {
    return { kind: "topup", headline: changed.text, before: topBefore.find((b) => b.item === changed.item)?.text ?? null };
  }

  return { kind: "history", headline: `${cardName} · ${after.text}` };
}
