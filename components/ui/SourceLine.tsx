import { cx } from "./cx";
import { Icon } from "./Icon";

/**
 * Rule 4: where a list or fact comes from and how old it is, right under it. Quiet, but always
 * there: "From the NHIA list, October 2026", "Patient reports, held by the burst rule".
 */
export function SourceLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cx("flex items-start gap-1.5 text-sm text-muted", className)}>
      <Icon name="clock" className="mt-0.5 h-4 w-4" />
      <span>{children}</span>
    </p>
  );
}
