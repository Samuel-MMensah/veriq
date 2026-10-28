import type { Metadata } from "next";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { FreshPhone } from "@/components/staff/FreshPhone";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { Toast } from "@/components/ui/Toast";
import { staffGate } from "@/lib/auth/session";
import type { SearchParams } from "@/lib/view/catalog";
import { accraClock } from "@/lib/view/status";
import { resetDemoAction } from "./actions";

export const metadata: Metadata = { title: "Demo data" };

const PATH = "/admin/demo";
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

// Admin: the demo reset (Prompt 8) for rehearsals. Everything here is sample data.
export default async function DemoAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok)
    return (
      <StaffGateScreen
        role="admin"
        staff={gate.staff}
        title="Demo data"
        subtitle="Before every rehearsal"
        path={PATH}
      />
    );

  const sp = await searchParams;
  const resetAt = Number(first(sp.reset));
  const error = first(sp.error);

  return (
    <>
      <AdminPageHeader
        title="Demo data"
        description="Rehearsals only. Real hospitals are never touched."
        action={<SampleDataTag />}
      />
      <AdminBody>
        {resetAt > 0 && (
          <Toast>
            Demo data reset at {accraClock(new Date(resetAt).toISOString())}.
            The demo story starts fresh.
          </Toast>
        )}
        {error && <Toast tone="error">Reset failed: {error}</Toast>}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
          <Card title="Reset demo data" titleId="reset" divided>
            <p className="text-muted">
              Puts all 18 sample hospitals back as the demo script expects:
              Akoma confirmed 2 days ago and open, Pinecrest with 9 refusals,
              the GH¢ 80 scan top-up, and fresh times. It removes every report,
              morning check and search made since. Real hospitals from the NHIA
              list, staff accounts and the admin log are never touched.
            </p>
            <form action={resetDemoAction} className="mt-4">
              <Button full size="lg">
                Reset demo data
              </Button>
            </form>
          </Card>

          <Card title="This phone" titleId="phone" divided>
            <p className="mb-4 text-muted">
              Saved cards and first open live on the phone, not in the data
              above.
            </p>
            <FreshPhone />
            <Button href="/?demo=1" variant="text" full className="mt-2">
              Open the app in demo mode
            </Button>
          </Card>
        </div>
      </AdminBody>
    </>
  );
}
