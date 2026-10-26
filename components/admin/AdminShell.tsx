import Link from "next/link";
import { staffSignOut } from "@/lib/auth/actions";
import type { Staff } from "@/lib/auth/staff";
import { AdminNav } from "./AdminNav";

/**
 * The admin frame (Prompt 10). Laptop: a dark side bar with the navigation and who is signed in,
 * and wide content. Phone (390 px): a dark top bar with the same links as tabs.
 */
export function AdminShell({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  const who = (
    <>
      <span className="block truncate text-sm font-semibold text-white">{staff.name}</span>
      <span className="block truncate text-sm text-white/70">{staff.kind === "demo" ? "Demo login, rehearsals only" : staff.email}</span>
    </>
  );
  const signOut = (
    <form action={staffSignOut}>
      <input type="hidden" name="next" value="/admin" />
      <button type="submit" className="min-h-11 rounded-(--radius-control) px-2 text-sm font-semibold text-white underline-offset-4 hover:underline">
        Sign out
      </button>
    </form>
  );
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden bg-ink lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-6 p-4">
          <Link href="/admin" className="flex min-h-11 items-center px-3 text-lg font-bold text-white">
            veriq <span className="ml-1.5 font-semibold text-patient">admin</span>
          </Link>
          <AdminNav layout="side" />
          <div className="mt-auto space-y-2 border-t border-white/10 px-3 pt-4">
            {who}
            <div className="-ml-2 flex gap-1">
              {staff.kind === "account" && (
                <Link href="/staff/password" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-white/80 hover:text-white">
                  Password
                </Link>
              )}
              {signOut}
            </div>
          </div>
        </div>
      </aside>

      <header className="bg-ink px-4 pt-3 pb-2 text-white lg:hidden">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Link href="/admin" className="inline-flex min-h-11 items-center font-bold">
            veriq <span className="ml-1.5 font-semibold text-patient">admin</span>
          </Link>
          {signOut}
        </div>
        <AdminNav layout="tabs" />
      </header>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** The top of an admin screen: one title, one line on what it is for, and at most one action. */
export function AdminPageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-6 pb-4 sm:px-6 lg:px-8 lg:pt-10">
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight font-extrabold lg:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** The body of an admin screen, with the same side padding as the header. */
export function AdminBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <main className={`min-w-0 space-y-4 px-4 pb-10 break-words sm:px-6 lg:space-y-6 lg:px-8 ${className}`}>{children}</main>;
}
