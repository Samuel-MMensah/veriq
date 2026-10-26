import type { TodayTile } from "@/lib/view/facility";
import type { StatusTone } from "@/lib/view/status";

const TILE: Record<StatusTone, string> = {
  good: "bg-brand-soft text-brand-strong",
  later: "bg-warn-bg text-warn-ink",
  bad: "bg-danger-bg text-danger-ink",
  unknown: "bg-neutral-bg text-neutral-ink",
};

export function TodayGrid({ tiles, updated }: { tiles: TodayTile[]; updated: string | null }) {
  const withNews = tiles.filter((t) => t.status.freshness.state !== "none");
  // Rule F: services that were never updated still say so, in one line.
  const noNews = tiles.filter((t) => t.status.freshness.state === "none");

  return (
    <section aria-labelledby="today" className="rounded-(--radius-card) bg-surface p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today" className="text-lg font-bold">
          Today
        </h2>
        <p className="text-right text-sm text-muted">{updated ?? "No update yet"}</p>
      </div>
      {withNews.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {withNews.map((t) => {
            const { freshness } = t.status;
            return (
              <li key={t.serviceId} className={`rounded-(--radius-control) px-3 py-3 ${TILE[t.status.tone]} ${freshness.greyed ? "opacity-60" : ""}`}>
                <p className="text-sm text-ink/75">{t.label}</p>
                <p className="text-lg font-bold leading-tight">{t.status.word}</p>
                {(freshness.state === "aging" || freshness.state === "stale") && (
                  <p className="mt-1 text-sm font-medium text-ink/75">
                    {freshness.updatedText} · {freshness.warning}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {noNews.length > 0 && (
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted">
            <span>
              <span className="font-semibold">No update yet</span> for {noNews.length} more{" "}
              {noNews.length === 1 ? "service" : "services"}. <span className="font-semibold text-brand">Show</span>
            </span>
          </summary>
          <p className="text-sm text-muted">
            {noNews.map((t) => (t.usualHours ? `${t.label} (usually ${t.usualHours})` : t.label)).join(", ")}
          </p>
        </details>
      )}
    </section>
  );
}
