import { cx } from "./cx";
import { Icon } from "./Icon";

/**
 * The answer to what you just did, at the top of the screen: "Saved", or what went wrong and what to
 * do. Errors are alerts (read out at once); good news is a polite status.
 */
export function Toast({ tone = "good", children, className }: { tone?: "good" | "error"; children: React.ReactNode; className?: string }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "flex animate-enter items-start gap-3 rounded-(--radius-card) p-4 font-semibold",
        tone === "good" ? "bg-good-bg text-good-ink" : "bg-danger-bg text-danger-ink",
        className,
      )}
    >
      <Icon name={tone === "good" ? "check" : "alert"} className="mt-0.5 h-5 w-5" />
      <span>{children}</span>
    </p>
  );
}
