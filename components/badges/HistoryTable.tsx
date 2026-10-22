import { PERIOD_LABEL, type Period, type ReportHistory } from "@/lib/rules/history";

const PERIODS: Period[] = ["week", "month", "year"];
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Patient reports for the last 7 days, 30 days and 12 months (team decision 2026-10-22). */
export function HistoryTable({ history }: { history: ReportHistory }) {
  if (history.year.accepted === 0 && history.year.refused === 0) {
    return <p className="mt-1 text-xs text-ink/70">No patient reports in the {PERIOD_LABEL.year}.</p>;
  }
  return (
    <table className="mt-2 w-full table-fixed text-left text-xs text-ink/70">
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
