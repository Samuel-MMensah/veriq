import type { Metadata } from "next";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { CallImport } from "@/components/admin/CallImport";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Button } from "@/components/ui/Button";
import { staffGate } from "@/lib/auth/session";
import { adminMayAct } from "@/lib/auth/staff";
import { previewImportAction, saveImportAction } from "../actions";

export const metadata: Metadata = { title: "Import paper calls" };

const PATH = "/admin/calls/import";

// Prompt 10b, item 5: calls recorded on paper. A dry-run preview first; nothing saved until confirmed.
export default async function ImportCallsPage() {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Import paper calls" path={PATH} />;
  return (
    <>
      <AdminPageHeader
        title="Import paper calls"
        description="Preview first. Nothing is saved until you confirm."
        narrow
        action={<Button href="/admin/calls" variant="secondary">All calls</Button>}
      />
      <AdminBody narrow>
        <CallImport preview={previewImportAction} save={saveImportAction} canSave={adminMayAct(gate.staff, { source: "nhia" })} />
      </AdminBody>
    </>
  );
}
