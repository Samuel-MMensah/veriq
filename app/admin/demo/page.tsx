import type { Metadata } from "next";
import Link from "next/link";
import { DemoLogin } from "@/components/staff/DemoLogin";
import { FreshPhone } from "@/components/staff/FreshPhone";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { Icon } from "@/components/ui/Icon";
import { currentStaff, demoLoginEnabled } from "@/lib/auth/session";
import type { SearchParams } from "@/lib/view/catalog";
import { accraClock } from "@/lib/view/status";
import { resetDemoAction } from "./actions";

export const metadata: Metadata = { title: "Demo data" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Admin, Phase 1: only the demo reset (SPEC section 2). Everything here is sample data.
export default async function DemoAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await currentStaff();
  if (staff?.role !== "admin") {
    return (
      <div className="mx-auto min-h-dvh max-w-md bg-page">
        <StaffHeader product="admins" staff={null} title="Demo data" path="/admin/demo" />
        <DemoLogin account="admin-demo" who="the demo presenter" next="/admin/demo" enabled={demoLoginEnabled()} />
      </div>
    );
  }

  const sp = await searchParams;
  const resetAt = Number(first(sp.reset));
  const error = first(sp.error);

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-page">
      <StaffHeader product="admins" staff={staff} title="Demo data" subtitle="Before every pitch" path="/admin/demo" />
      <main className="space-y-4 px-4 py-4">
        {resetAt > 0 && (
          <p role="status" className="flex gap-3 rounded-2xl bg-brand/10 p-4 font-semibold text-brand">
            <Icon name="check" className="mt-0.5 h-5 w-5" />
            Demo data reset at {accraClock(new Date(resetAt).toISOString())}. The demo story starts fresh.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-emergency-bg p-4 font-semibold text-emergency">
            Reset failed: {error}
          </p>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">Reset demo data</h2>
          <p className="mt-1 text-ink/80">
            Puts all 18 sample hospitals back as the demo script expects: Akoma confirmed 2 days ago and open, Pinecrest
            with 9 refusals, the GH¢ 80 scan top-up, and fresh times. It removes every report, morning check and search
            made since. Real hospitals are never touched (sample data only).
          </p>
          <form action={resetDemoAction} className="mt-4">
            <button type="submit" className="min-h-14 w-full rounded-2xl bg-brand px-4 text-lg font-bold text-white">
              Reset demo data
            </button>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">This phone</h2>
          <p className="mt-1 mb-4 text-ink/80">Saved cards and first open live on the phone, not in the data above.</p>
          <FreshPhone />
        </section>

        <Link href="/" className="flex min-h-12 items-center justify-center font-bold text-brand underline">
          Open the app&apos;s start page
        </Link>
      </main>
    </div>
  );
}
