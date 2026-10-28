import { cx } from "./cx";

/**
 * Rule 4: where a list or fact comes from and how old it is, right under it. Quiet, but always
 * there: "From the NHIA list, October 2026", "Patient reports, held by the burst rule".
 */
export function SourceLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cx("text-small text-muted", className)}>{children}</p>
  );
}
