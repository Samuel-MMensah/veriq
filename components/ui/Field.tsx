import { cx } from "./cx";

export function inputClass(invalid = false): string {
  return cx(
    "block min-h-12 w-full rounded-(--radius-control) border bg-surface px-3 text-base text-ink placeholder:text-muted",
    "transition-colors focus:border-brand",
    invalid ? "border-danger-ink" : "border-line-strong",
  );
}

/** For the control inside a Field: ties the hint and the error to it. */
export function describedBy(id: string, hint?: unknown, error?: unknown): string | undefined {
  return [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

/**
 * A label, the control, an optional hint and an error that says how to fix it, in plain words.
 * Give the control id={id}, aria-describedby={describedBy(id, hint, error)} and aria-invalid.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-sm text-muted">
          {hint}
        </p>
      )}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}
