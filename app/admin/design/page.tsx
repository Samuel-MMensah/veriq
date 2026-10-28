import type { Metadata } from "next";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { BadgeLine } from "@/components/badges/BadgeLine";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, inputClass } from "@/components/ui/Field";
import { ListRow } from "@/components/ui/ListRow";
import { SourceLine } from "@/components/ui/SourceLine";
import { Toast } from "@/components/ui/Toast";
import { staffGate } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Design sample" };

const PATH = "/admin/design";

// Prompt 10c: green for actions and "confirmed", orange for refusals and warnings, red for emergency
// only, neutrals for everything else.
const COLOURS: { name: string; token: string; use: string }[] = [
  { name: "Green", token: "bg-brand", use: "Primary action, confirmed" },
  { name: "Green, soft", token: "bg-brand-soft", use: "Confirmed badges, selected" },
  { name: "Orange", token: "bg-warn-bg", use: "Refusals and warnings" },
  { name: "Red", token: "bg-emergency", use: "Emergency only" },
  { name: "Ink", token: "bg-ink", use: "Text, staff side bar" },
  { name: "Muted", token: "bg-muted", use: "Secondary text, source lines" },
  { name: "Page", token: "bg-page", use: "Page background" },
  { name: "Line", token: "bg-line", use: "Hairlines and dividers" },
];

const TYPE: { role: string; cls: string }[] = [
  { role: "Display 40 / 700, headline numbers only", cls: "text-display" },
  { role: "Page title 24 / 700", cls: "text-title" },
  { role: "Section title 18 / 700", cls: "text-section" },
  { role: "Body 16 / 400 and 600", cls: "text-body" },
  { role: "Small 14", cls: "text-small text-muted" },
];

// The one-page visual sample for docs/DESIGN.md (Prompt 10): every token and shared component.
export default async function DesignPage() {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Design sample" path={PATH} />;
  return (
    <>
      <AdminPageHeader title="Design sample" description="Tokens and components. See docs/DESIGN.md." />
      <AdminBody>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <Card title="Colour, for meaning" titleId="colour" divided>
            <ul className="grid grid-cols-2 gap-3">
              {COLOURS.map((c) => (
                <li key={c.name} className="flex items-center gap-3">
                  <span aria-hidden="true" className={`h-10 w-10 shrink-0 rounded-(--radius-control) border border-line ${c.token}`} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-small text-muted">{c.use}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Type scale" titleId="type" divided>
            <ul className="space-y-2">
              {TYPE.map((t) => (
                <li key={t.role} className="flex items-baseline justify-between gap-3">
                  <span className={t.cls}>{t.cls === "text-display" ? "693" : "Know before you go"}</span>
                  <span className="shrink-0 text-small text-muted">{t.role}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Buttons" titleId="buttons" divided>
            <div className="flex flex-wrap gap-2">
              <Button type="button">Primary</Button>
              <Button type="button" variant="secondary">
                Secondary
              </Button>
              <Button type="button" variant="text">
                Text
              </Button>
            </div>
            <Button type="button" size="lg" full className="mt-3">
              Large, full width: one per screen
            </Button>
          </Card>

          <Card title="Badges and status" titleId="badges" divided>
            <div className="flex flex-wrap gap-2">
              <Badge tone="good">Verified</Badge>
              <Badge tone="warn">Waiting</Badge>
              <Badge tone="neutral">Switched off</Badge>
              <Badge>Not checked</Badge>
            </div>
            <div className="mt-3 space-y-2">
              <BadgeLine cardName="NHIS" badge={{ id: "B2", tone: "hospital", text: "Confirmed by hospital 2 days ago" }} />
              <BadgeLine cardName="NHIS" badge={{ id: "B1", tone: "refused", text: "Listed, but 9 patients were refused in the last 30 days" }} />
            </div>
            <SourceLine className="mt-3">From the NHIA list, October 2026</SourceLine>
          </Card>

          <Card title="List rows" titleId="rows" divided>
            <ul className="divide-y divide-line">
              <li>
                <ListRow href="#rows" title="Dansoman Polyclinic" detail="Polyclinic · Dansoman" meta="Claimed today, 9:15 am" trailing={<Badge tone="warn">Waiting</Badge>} />
              </li>
              <li>
                <ListRow title="Akoma Mission Hospital" detail="Mission · Kaneshie" trailing={<Badge tone="good">Verified</Badge>} />
              </li>
            </ul>
          </Card>

          <Card title="Form field" titleId="field" divided>
            <Field id="sample-email" label="Work email" hint="The person's own work address." error="Type a work email address, e.g. name@hospital.org.">
              <input id="sample-email" defaultValue="ama@" aria-invalid className={inputClass(true)} aria-describedby="sample-email-hint sample-email-error" />
            </Field>
          </Card>

          <div className="space-y-3">
            <Toast>Saved. Patients see it now.</Toast>
            <Toast tone="error">That point is outside Greater Accra. Check the order and the minus sign.</Toast>
          </div>

          <Card>
            <EmptyState title="No held reports" action={<Button href="#field" variant="secondary">Next step</Button>}>
              Nothing is waiting. Say why, and offer the next step.
            </EmptyState>
          </Card>
        </div>
      </AdminBody>
    </>
  );
}
