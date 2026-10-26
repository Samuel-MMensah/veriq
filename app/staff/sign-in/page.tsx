import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/staff/SignInForm";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { Card } from "@/components/ui/Card";
import { currentStaff } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/staff";
import type { SearchParams } from "@/lib/view/catalog";

export const metadata: Metadata = { title: "Staff sign-in" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Staff sign-in (Prompt 10): email and password for hospital, insurer and admin staff.
export default async function SignInPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const next = first((await searchParams).next);
  const staff = await currentStaff();
  if (staff) redirect(staff.mustChangePassword ? "/staff/password" : safeNext(next, staff.role));
  return (
    <div className="min-h-dvh bg-page">
      <StaffHeader product="staff" staff={null} title="Sign in" subtitle="For hospital, insurer and Veriq staff" path="/staff/sign-in" sample={false} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <Card>
          <SignInForm next={next ?? ""} />
        </Card>
        <p className="px-1 text-sm text-muted">
          A Veriq admin makes staff accounts and hands you a one-time password in person or by phone. Nothing is sent by
          email or text. Forgot your password? Ask a Veriq admin to reset it.
        </p>
      </main>
    </div>
  );
}
