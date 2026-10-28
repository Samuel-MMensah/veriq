import { Icon, type IconName } from "./Icon";

/** Nothing to show: an icon, one line, and one action. Never a dead end. */
export function EmptyState({
  icon = "check",
  title,
  children,
  action,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  /** Inside a staff card: icon and words on one row, no tall gap. */
  compact?: boolean;
}) {
  if (compact)
    return (
      <div className="flex items-center gap-3 py-1">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {children && <div className="text-small text-muted">{children}</div>}
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
    );
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-3 text-section">{title}</p>
      {children && <div className="mt-1 max-w-sm text-small text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
