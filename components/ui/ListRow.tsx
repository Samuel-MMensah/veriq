import Link from "next/link";
import { cx } from "./cx";
import { Icon } from "./Icon";

/**
 * One row in a list: a title, a line of detail, a quieter source line, something on the right, and
 * a chevron when it opens a page. At least 56 px tall; the whole row is the target (rule 7).
 */
export function ListRow({
  href,
  title,
  detail,
  meta,
  trailing,
  className,
}: {
  href?: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  /** Usually the source and time (rule 4). */
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">{title}</span>
        {detail && <span className="mt-0.5 block text-sm text-muted">{detail}</span>}
        {meta && <span className="mt-0.5 block text-sm text-muted">{meta}</span>}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
      {href && <Icon name="chevron" className="h-5 w-5 text-brand" />}
    </>
  );
  const cls = cx("flex min-h-14 items-center gap-3 py-3", className);
  return href ? (
    <Link href={href} className={cx(cls, "-mx-2 rounded-(--radius-control) px-2 transition-colors hover:bg-brand-soft/60")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
