import { Icon, type IconName } from "./Icon";

/** Nothing to show: say so plainly, say why, and offer the next step. Never a dead end. */
export function EmptyState({
  icon = "check",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-3 text-lg font-bold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
