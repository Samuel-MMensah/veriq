import { Button } from "@/components/ui/Button";
import { staffSignOut } from "@/lib/auth/actions";
import type { DemoAccount } from "@/lib/auth/demo";
import { demoLoginEnabled } from "@/lib/auth/session";
import { HOME, type Staff } from "@/lib/auth/staff";
import type { StaffRole } from "@/lib/db/types";
import { CentredCard } from "./CentredCard";
import { DemoLogin } from "./DemoLogin";
import { SignInForm } from "./SignInForm";

const AREA: Record<StaffRole, { area: string; who: string }> = {
  admin: { area: "admin", who: "Veriq admins" },
  hospital: { area: "hospitals", who: "hospital staff" },
  insurer: { area: "insurers", who: "insurer staff" },
};

const DEMO: Record<StaffRole, { account: DemoAccount["key"]; who: string }> = {
  admin: { account: "admin-demo", who: "the demo presenter" },
  hospital: { account: "hospital-akoma", who: "Akoma Mission Hospital front desk (Esi)" },
  insurer: { account: "insurer-nhis", who: "NHIS network team (Kojo)" },
};

/**
 * What a staff page shows to someone who may not see it (Prompt 10 role checks), as a centred card
 * (Prompt 10c): sign-in when nobody is signed in, or "this page is for ..." for another role.
 */
export function StaffGateScreen({
  role,
  staff,
  path,
}: {
  role: StaffRole;
  staff: Staff | null;
  /** Kept for callers; the gate is titled "Sign in" or "This page is for …". */
  title?: string;
  subtitle?: string;
  path: string;
}) {
  const { area, who } = AREA[role];
  // Rehearsals switch between demo accounts (demo script steps 6 and 8).
  const demo = demoLoginEnabled() && (!staff || staff.kind === "demo") ? (
    <DemoLogin account={DEMO[role].account} who={DEMO[role].who} next={path} />
  ) : null;

  if (staff) {
    return (
      <CentredCard area={area} title={`This page is for ${who}.`} below={demo}>
        <p className="text-muted">You are signed in as {AREA[staff.role].who.replace(/s$/, "")}.</p>
        <div className="mt-5 grid gap-2">
          <Button href={HOME[staff.role]}>Go to your page</Button>
          <form action={staffSignOut}>
            <input type="hidden" name="next" value={path} />
            <Button variant="secondary" full>
              Sign out
            </Button>
          </form>
        </div>
      </CentredCard>
    );
  }
  return (
    <CentredCard area={area} title="Sign in" below={demo}>
      <SignInForm next={path} />
    </CentredCard>
  );
}
