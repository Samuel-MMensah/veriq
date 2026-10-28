/**
 * Staff sign-in and gate screens (Prompt 10c): a centred card with the wordmark, one title and the
 * form. Anything else (the demo login on a rehearsal site) sits below the card.
 */
export function CentredCard({
  area,
  title,
  children,
  below,
}: {
  /** "staff", "hospitals", "insurers" or "admin": the word after the wordmark. */
  area: string;
  title: string;
  children: React.ReactNode;
  below?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-start justify-center bg-page px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm space-y-4">
        <p aria-hidden="true" className="text-center text-section text-brand">
          veriq <span className="font-semibold text-muted">{area}</span>
        </p>
        <main className="rounded-(--radius-card) bg-surface p-6 shadow-card">
          <h1 className="text-title">{title}</h1>
          <div className="mt-5">{children}</div>
        </main>
        {below}
      </div>
    </div>
  );
}
