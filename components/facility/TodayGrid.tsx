import type { TodayTile } from "@/lib/view/facility";
import type { StatusTone } from "@/lib/view/status";

const TILE: Record<StatusTone, string> = {
  good: "bg-brand/10 text-brand",
  later: "bg-refused-bg text-refused-ink",
  bad: "bg-emergency-bg text-emergency",
  unknown: "bg-ink/[0.05] text-ink/70",
};

export function TodayGrid({ tiles, updated }: { tiles: TodayTile[]; updated: string | null }) {
  const withNews = tiles.filter((t) => t.status.freshness.state !== "none");
  // Rule F: services that were never updated still say so, in one line.
  const noNews = tiles.filter((t) => t.status.freshness.state === "none");

  return (
    <section aria-labelledby="today" className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today" className="text-lg font-bold">
          Today
        </h2>
        <p className="text-right text-sm text-ink/70">{updated ?? "No update yet"}</p>
      </div>
      {withNews.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {withNews.map((t) => {
            const { freshness } = t.status;
            return (
              <li key={t.serviceId} className={`rounded-xl p-3 ${TILE[t.status.tone]} ${freshness.greyed ? "opacity-60" : ""}`}>
                <p className="text-sm text-ink/80">{t.label}</p>
                <p className="text-lg font-bold leading-tight">{t.status.word}</p>
                {(freshness.state === "aging" || freshness.state === "stale") && (
                  <p className="mt-1 text-xs font-medium text-ink/70">
                    {freshness.updatedText} · {freshness.warning}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {noNews.length > 0 && (
        <p className="mt-3 text-sm text-ink/70">
          <span className="font-semibold">No update yet:</span>{" "}
          {noNews.map((t) => (t.usualHours ? `${t.label} (usually ${t.usualHours})` : t.label)).join(", ")}
        </p>
      )}
    </section>
  );
}
