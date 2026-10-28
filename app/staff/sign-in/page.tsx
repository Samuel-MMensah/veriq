import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CentredCard } from "@/components/staff/CentredCard";
import { SignInForm } from "@/components/staff/SignInForm";
import { currentStaff } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/staff";
import type { SearchParams } from "@/lib/view/catalog";

export const metadata: Metadata = { title: "Staff sign-in" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Staff sign-in (Prompt 10, centred card since Prompt 10c): email, password, one button.
export default async function SignInPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const next = first((await searchParams).next);
  const staff = await currentStaff();
  if (staff) redirect(staff.mustChangePassword ? "/staff/password" : safeNext(next, staff.role));
  return (
    <CentredCard area="staff" title="Sign in">
      <SignInForm next={next ?? ""} />
    </CentredCard>
  );
}
