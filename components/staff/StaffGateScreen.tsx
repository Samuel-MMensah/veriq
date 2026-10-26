import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { staffSignOut } from "@/lib/auth/actions";
import type { DemoAccount } from "@/lib/auth/demo";
import { demoLoginEnabled } from "@/lib/auth/session";
import { HOME, type Staff } from "@/lib/auth/staff";
import type { StaffRole } from "@/lib/db/types";
import { DemoLogin } from "./DemoLogin";
import { SignInForm } from "./SignInForm";
import { StaffHeader } from "./StaffHeader";

const AREA: Record<StaffRole, { product: "hospitals" | "insurers" | "admins"; who: string }> = {
  admin: { product: "admins", who: "Veriq admins" },
  hospital: { product: "hospitals", who: "hospital staff" },
  insurer: { product: "insurers", who: "insurer staff" },
};

const DEMO: Record<StaffRole, { account: DemoAccount["key"]; who: string }> = {
  admin: { account: "admin-demo", who: "the demo presenter" },
  hospital: { account: "hospital-akoma", who: "Akoma Mission Hospital front desk (Esi)" },
  insurer: { account: "insurer-nhis", who: "NHIS network team (Kojo)" },
};

/**
 * What a staff page shows to someone who may not see it: sign-in when nobody is signed in, or
 * "this page is for ..." when the signed-in role is a different one (Prompt 10 role checks).
 */
export function StaffGateScreen({
  role,
  staff,
  title,
  subtitle,
  path,
}: {
  role: StaffRole;
  staff: Staff | null;
  title: string;
  subtitle?: string;
  path: string;
}) {
  const area = AREA[role];
  return (
    <div className="min-h-dvh bg-page">
      <StaffHeader product={area.product} staff={staff} title={title} subtitle={subtitle} path={path} sample={false} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {staff ? (
          <Card>
            <p className="flex items-start gap-3">
              <Icon name="lock" className="mt-0.5 h-5 w-5 text-muted" />
              <span>
                <strong className="block text-lg">This page is for {area.who}.</strong>
                <span className="text-muted">You are signed in as {AREA[staff.role].who.replace(/s$/, "")}.</span>
              </span>
            </p>
            <div className="mt-4 grid gap-2">
              <Button href={HOME[staff.role]}>Go to your page</Button>
              <form action={staffSignOut}>
                <input type="hidden" name="next" value={path} />
                <Button variant="secondary" full>
                  Sign out
                </Button>
              </form>
            </div>
          </Card>
        ) : null}
        {/* Rehearsals switch between demo accounts (demo script steps 6 and 8). */}
        {staff?.kind === "demo" && demoLoginEnabled() && <DemoLogin account={DEMO[role].account} who={DEMO[role].who} next={path} />}
        {staff ? null : (
          <>
            <Card title="Sign in" titleId="sign-in">
              <SignInForm next={path} />
              <p className="mt-4 text-sm text-muted">
                No account yet, or forgot your password? A Veriq admin makes accounts and resets passwords. Nothing is sent by email or text.
              </p>
            </Card>
            {demoLoginEnabled() && <DemoLogin account={DEMO[role].account} who={DEMO[role].who} next={path} />}
          </>
        )}
      </main>
    </div>
  );
}
