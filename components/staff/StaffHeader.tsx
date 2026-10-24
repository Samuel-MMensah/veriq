import { SampleDataTag } from "@/components/ui/SampleDataTag";
import type { DemoAccount } from "@/lib/auth/demo";
import { staffSignOut } from "@/lib/auth/actions";

/** Dark header for the hospital and insurer views (screens 16 and 18). */
export function StaffHeader({
  product,
  staff,
  title,
  subtitle,
  path,
}: {
  product: "hospitals" | "insurers";
  staff: DemoAccount | null;
  title: string;
  subtitle?: string;
  /** Where to land after signing out. */
  path: string;
}) {
  return (
    <header className="bg-ink px-4 pb-5 pt-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-patient">veriq for {product}</p>
        <div className="flex items-center gap-3">
          {staff && (
            <>
              <span className="text-sm text-white/80">
                {staff.title} · {staff.name}
              </span>
              <form action={staffSignOut}>
                <input type="hidden" name="next" value={path} />
                <button type="submit" className="min-h-11 text-sm font-semibold underline">
                  Sign out
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-white/80">{subtitle}</p>}
        </div>
        {staff && <SampleDataTag onDark className="mt-2 shrink-0" />}
      </div>
    </header>
  );
}
