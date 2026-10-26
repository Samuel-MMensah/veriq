import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { staffSignOut } from "@/lib/auth/actions";
import type { Staff } from "@/lib/auth/staff";

/** Dark header for the hospital and insurer views (screens 16 and 18) and the sign-in screens. */
export function StaffHeader({
  product,
  staff,
  title,
  subtitle,
  path,
  sample,
}: {
  product: "hospitals" | "insurers" | "admins" | "staff";
  staff: Staff | null;
  title: string;
  subtitle?: string;
  /** Where to land after signing out. */
  path: string;
  /** Rule 1: shown while demo hospitals are on the screen. Defaults to "signed in with the demo login". */
  sample?: boolean;
}) {
  const showSample = sample ?? staff?.kind === "demo";
  return (
    <header className="bg-ink px-4 pt-4 pb-6 text-white">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <p className="font-bold">
          veriq <span className="font-semibold text-patient">for {product}</span>
        </p>
        {staff && (
          <form action={staffSignOut} className="flex min-w-0 items-center gap-3">
            <span className="min-w-0 truncate text-sm text-white/80">{staff.kind === "demo" ? `${staff.title} · ${staff.name}` : staff.name}</span>
            <input type="hidden" name="next" value={path} />
            <button type="submit" className="min-h-11 rounded-(--radius-control) px-2 text-sm font-semibold underline-offset-4 hover:underline">
              Sign out
            </button>
          </form>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-white/80">{subtitle}</p>}
        </div>
        {showSample && <SampleDataTag onDark className="mt-2 shrink-0" />}
      </div>
    </header>
  );
}
