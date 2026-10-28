import Link from "next/link";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { staffSignOut } from "@/lib/auth/actions";
import type { Staff } from "@/lib/auth/staff";
import { StaffNav, type NavItem } from "./StaffNav";

/**
 * One frame for hospital staff, insurers and admin (Prompt 10c). Laptop: a dark side bar with the
 * wordmark, the navigation and who is signed in; content up to about 1200 px. Phone (390 px): a dark
 * top bar with the same links as tabs.
 */
export function StaffShell({
  staff,
  area,
  nav,
  signOutTo,
  children,
}: {
  staff: Staff;
  /** "hospitals", "insurers" or "admin": the word after the wordmark. */
  area: string;
  nav: NavItem[];
  /** Where to land after signing out. */
  signOutTo: string;
  children: React.ReactNode;
}) {
  const home = nav[0]?.href ?? "/";
  // "Front desk · Esi" for a demo login; the name (and email on the laptop) for a real account.
  const who = staff.kind === "demo" ? `${staff.title} · ${staff.name}` : staff.name;
  const signOut = (
    <form action={staffSignOut}>
      <input type="hidden" name="next" value={signOutTo} />
      <button type="submit" className="min-h-11 rounded-(--radius-control) px-2 text-small font-semibold text-white underline-offset-4 hover:underline">
        Sign out
      </button>
    </form>
  );
  const wordmark = (
    <>
      veriq <span className="ml-1.5 font-semibold text-white/70">{area}</span>
    </>
  );
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden bg-ink lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-6 p-4">
          <Link href={home} className="flex min-h-11 items-center px-3 text-section text-white">
            {wordmark}
          </Link>
          <StaffNav items={nav} layout="side" label={area} />
          <div className="mt-auto space-y-1 border-t border-white/10 px-3 pt-4">
            <span className="block truncate text-small font-semibold text-white">{who}</span>
            {staff.kind === "account" && staff.email && <span className="block truncate text-small text-white/70">{staff.email}</span>}
            <div className="-ml-2 flex gap-1">
              {staff.kind === "account" && (
                <Link href="/staff/password" className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-white/80 hover:text-white">
                  Password
                </Link>
              )}
              {signOut}
            </div>
          </div>
        </div>
      </aside>

      <header className="bg-ink px-4 pt-2 pb-2 text-white lg:hidden">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Link href={home} className="inline-flex min-h-11 items-center font-semibold">
            {wordmark}
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-small text-white/80">{who}</span>
            {signOut}
          </div>
        </div>
        {nav.length > 1 && <StaffNav items={nav} layout="tabs" label={area} />}
      </header>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** The top of a staff screen: one title, at most one short line, the SAMPLE DATA tag, at most one action. */
export function StaffPageHeader({
  title,
  description,
  action,
  sample = false,
  narrow = false,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Rule 1: a demo hospital is on this screen. */
  sample?: boolean;
  /** A form screen (the morning check): about 670 px wide on a laptop. */
  narrow?: boolean;
}) {
  return (
    <div className={`mx-auto flex ${narrow ? "max-w-2xl" : "max-w-[1200px]"} flex-wrap items-start justify-between gap-3 px-4 pt-6 pb-4 sm:px-6 lg:px-8 lg:pt-10`}>
      <div className="min-w-0">
        <h1 className="text-title">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        {action}
        {sample && <SampleDataTag />}
      </div>
    </div>
  );
}

/** The body of a staff screen: the same side padding as the header, content up to about 1200 px. */
export function StaffBody({ children, className = "", narrow = false }: { children: React.ReactNode; className?: string; narrow?: boolean }) {
  return (
    <main className={`mx-auto min-w-0 ${narrow ? "max-w-2xl" : "max-w-[1200px]"} space-y-4 px-4 pb-10 break-words sm:px-6 lg:space-y-6 lg:px-8 ${className}`}>
      {children}
    </main>
  );
}
