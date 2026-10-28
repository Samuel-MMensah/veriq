import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CentredCard } from "@/components/staff/CentredCard";
import { NewPasswordForm } from "@/components/staff/SignInForm";
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
    <CentredCard area="staff" title={staff.mustChangePassword ? "Set your own password" : "Change your password"}>
      {staff.email && <p className="-mt-2 mb-4 text-small text-muted">{staff.email}</p>}
      <NewPasswordForm next={next} first={staff.mustChangePassword} />
    </CentredCard>
  );
}
