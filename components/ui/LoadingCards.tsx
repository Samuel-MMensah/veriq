/**
 * Shown at once while a data page loads on a slow connection (3G, rule 7), so a tap always gets an
 * answer. Grey blocks only: no made-up facts (rule 4).
 */
export function LoadingCards({ label, count = 3 }: { label: string; count?: number }) {
  return (
    <div className="min-h-dvh bg-page">
      <div className="border-b border-ink/10 bg-white px-4 pb-4 pt-5">
        <div className="h-7 w-2/3 animate-pulse rounded-lg bg-ink/10" />
        <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-ink/10" />
      </div>
      <div className="space-y-3 px-4 py-4">
        <p role="status" className="text-ink/80">
          {label}
        </p>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} aria-hidden="true" className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="h-5 w-3/5 animate-pulse rounded bg-ink/10" />
            <div className="mt-3 h-12 animate-pulse rounded-lg bg-ink/[0.07]" />
            <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-ink/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
