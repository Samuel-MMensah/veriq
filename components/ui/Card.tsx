import { cx } from "./cx";

/** The one card style: white, hairline border, 12 px corners, no heavy shadow. One idea per card. */
export function Card({
  title,
  titleId,
  aside,
  tone = "plain",
  className,
  children,
  as: Tag = "section",
}: {
  title?: React.ReactNode;
  /** Names the section for screen readers when there is a title. */
  titleId?: string;
  aside?: React.ReactNode;
  tone?: "plain" | "warn" | "danger";
  className?: string;
  children: React.ReactNode;
  as?: "section" | "div" | "li" | "article";
}) {
  return (
    <Tag
      aria-labelledby={title && titleId ? titleId : undefined}
      className={cx(
        "rounded-(--radius-card) p-4 sm:p-5",
        tone === "plain" && "bg-surface shadow-card",
        tone === "warn" && "bg-warn-bg text-warn-ink",
        tone === "danger" && "bg-danger-bg text-danger-ink",
        className,
      )}
    >
      {(title || aside) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && (
            <h2 id={titleId} className="text-section">
              {title}
            </h2>
          )}
          {aside && <div className="shrink-0 text-small text-muted">{aside}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
