import Link from "next/link";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

/** Three kinds only (Prompt 10c): primary (one per screen), secondary, and text. */
export type ButtonVariant = "primary" | "secondary" | "text";
/** lg is only for the one sticky bottom action on a phone screen. */
export type ButtonSize = "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong active:bg-brand-strong",
  secondary: "border border-line-strong bg-surface text-ink hover:border-brand hover:text-brand",
  text: "text-brand underline-offset-4 hover:underline",
};
const SIZE: Record<ButtonSize, string> = {
  md: "min-h-12 px-4 text-body",
  lg: "min-h-12 px-5 text-body",
};

/** Classes for anything that looks like a button (also used on a <label> or <summary>). */
export function buttonClass({
  variant = "primary",
  size = "md",
  full = false,
}: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean } = {}): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-semibold transition-colors duration-150",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    full && "w-full",
  );
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  icon?: IconName;
  className?: string;
  children: React.ReactNode;
};
type AsLink = Common & { href: string };
type AsButton = Common & { href?: undefined } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/** One button for the whole app, 48 px tall (rule 7). Pass `href` for a link. */
export function Button({ variant, size, full, icon, className, children, ...rest }: AsLink | AsButton) {
  const cls = cx(buttonClass({ variant, size, full }), className);
  const inner = (
    <>
      {icon && <Icon name={icon} className="h-5 w-5" />}
      {children}
    </>
  );
  if (rest.href !== undefined) {
    return (
      <Link href={rest.href} className={cls}>
        {inner}
      </Link>
    );
  }
  const attrs: React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined } = { ...rest };
  delete attrs.href;
  return (
    <button type="submit" {...attrs} className={cls}>
      {inner}
    </button>
  );
}
