import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewPasswordForm } from "@/components/staff/SignInForm";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { Card } from "@/components/ui/Card";
import { currentStaff } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/staff";
import type { SearchParams } from "@/lib/view/catalog";

export const metadata: Metadata = { title: "Set your password" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Prompt 10: on first sign-in the person replaces the one-time password with their own.
export default async function PasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await currentStaff();
  if (staff?.kind !== "account") redirect("/staff/sign-in");
  const next = safeNext(first((await searchParams).next), staff.role);
  return (
    <div className="min-h-dvh bg-page">
      <StaffHeader
        product="staff"
        staff={staff}
        title={staff.mustChangePassword ? "Set your own password" : "Change your password"}
        subtitle={staff.email ?? undefined}
        path="/staff/sign-in"
        sample={false}
      />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {staff.mustChangePassword && (
          <p className="px-1 text-muted">
            The password you were given works once. Choose your own now. Only you will know it, not even Veriq admins.
          </p>
        )}
        <Card>
          <NewPasswordForm next={next} first={staff.mustChangePassword} />
        </Card>
      </main>
    </div>
  );
}
