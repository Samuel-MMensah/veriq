import { PERIOD_LABEL, type Period, type ReportHistory } from "@/lib/rules/history";

const PERIODS: Period[] = ["week", "month", "year"];
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Patient reports for the last 7 days, 30 days and 12 months (team decision 2026-10-22).
 * One plain line shows; the full table opens on tap, so three cards don't bury the page in numbers.
 */
export function HistoryTable({ history }: { history: ReportHistory }) {
  if (history.year.accepted === 0 && history.year.refused === 0) {
    return <p className="mt-1 text-sm text-ink/70">No patient reports in the {PERIOD_LABEL.year}.</p>;
  }
  const { accepted, refused } = history.month;
  return (
    <details className="group mt-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm text-ink/80 [&::-webkit-details-marker]:hidden">
        <span>
          Patients, {PERIOD_LABEL.month}: <strong className="font-semibold text-ink">{accepted} card worked</strong> ·{" "}
          <strong className={`font-semibold ${refused ? "text-refused-ink" : "text-ink"}`}>{refused} refused</strong>
        </span>
        <span className="shrink-0 font-semibold text-brand group-open:hidden">More</span>
        <span className="hidden shrink-0 font-semibold text-brand group-open:inline">Less</span>
      </summary>
      <Table history={history} />
    </details>
  );
}

function Table({ history }: { history: ReportHistory }) {
  return (
    <table className="mt-1 w-full table-fixed text-left text-sm text-ink/70">
      <caption className="sr-only">Patient reports by period</caption>
      <thead>
        <tr>
          <th scope="col" className="w-1/4 font-medium">
            <span className="sr-only">Report</span>
          </th>
          {PERIODS.map((p) => (
            <th key={p} scope="col" className="font-medium">
              {sentence(PERIOD_LABEL[p])}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="font-semibold text-ink/80">
        <tr>
          <th scope="row" className="font-medium text-ink/70">
            Card worked
          </th>
          {PERIODS.map((p) => (
            <td key={p}>{history[p].accepted}</td>
          ))}
        </tr>
        <tr>
          <th scope="row" className="font-medium text-ink/70">
            Refused
          </th>
          {PERIODS.map((p) => (
            <td key={p}>{history[p].refused}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
