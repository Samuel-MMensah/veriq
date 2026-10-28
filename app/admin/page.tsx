import type { Metadata } from "next";
import Link from "next/link";
import { AdminBody, AdminPageHeader } from "@/components/admin/AdminShell";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ListRow } from "@/components/ui/ListRow";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { SourceLine } from "@/components/ui/SourceLine";
import { Toast } from "@/components/ui/Toast";
import { actionText, recentActions } from "@/lib/admin/log";
import { listHeldReports } from "@/lib/admin/reports";
import { listHospitalClaims } from "@/lib/admin/verify";
import { staffGate } from "@/lib/auth/session";
import { listNeedsLocation } from "@/lib/db/queries";
import { serviceDb } from "@/lib/db/server";
import { isDemoMode } from "@/lib/demo/mode";
import { sourceLine } from "@/lib/rules/directory";
import { DAY_MS } from "@/lib/rules/time";
import type { SearchParams } from "@/lib/view/catalog";
import { accraClock } from "@/lib/view/status";
import { whenText } from "@/lib/view/when";

export const metadata: Metadata = { title: "Admin" };

const PATH = "/admin";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Admin home (Prompt 10): what needs doing, each count opening its list.
export default async function AdminHome({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const gate = await staffGate("admin", PATH);
  if (!gate.ok) return <StaffGateScreen role="admin" staff={gate.staff} title="Admin" subtitle="Veriq staff only" path={PATH} />;
  const { staff } = gate;
  const sp = await searchParams;
  const db = await serviceDb();
  const now = new Date();
  // Rule D2: claims and held reports follow demo mode; "Needs a location" is about the real list only.
  const demo = await isDemoMode(sp);
  const source = demo ? "demo" : "nhia";
  const [needs, claims, held, recent] = await Promise.all([
    listNeedsLocation(db),
    listHospitalClaims(db, source),
    listHeldReports(db, source),
    recentActions(db, new Date(now.getTime() - 30 * DAY_MS).toISOString()),
  ]);
  const listSource = needs[0] ? sourceLine(needs[0]) : "From the NHIA list";
  const counted = `Counted at ${accraClock(now.toISOString())}`;

  return (
    <>
      <AdminPageHeader
        title={`Good ${greeting(now)}, ${staff.name.split(/[\s@]/)[0]}`}
        action={demo ? <SampleDataTag /> : undefined}
      />
      <AdminBody>
        {first(sp.password) === "set" && <Toast>Your password is saved.</Toast>}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4" aria-label="To do">
          <Todo
            href="/admin/hospitals"
            icon="shield"
            count={claims.waiting.length}
            label="Hospitals waiting for verification"
            source={`From staff accounts linked to ${demo ? "demo" : "real"} facilities · ${counted}`}
          />
          <Todo
            href="/admin/reports"
            icon="flag"
            count={held.length}
            label="Held reports to review"
            source={`Patient reports held by the burst rule (rule A) · ${counted}`}
          />
          <Todo href="/admin/locations" icon="pin" count={needs.length} label="Facilities needing a location" source={`${listSource} · ${counted}`} />
        </ul>

        <Card title="Recent admin actions" titleId="recent" aside="Last 30 days" divided>
          {recent.length === 0 ? (
            <EmptyState icon="history" title="Nothing yet" compact>
              Every admin action is logged here: who, what, when and why.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {recent.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <ListRow
                    href={a.facility_id ? `/admin/hospitals/${a.facility_id}` : a.profile_id ? `/admin/staff/${a.profile_id}` : undefined}
                    title={actionText(a.action)}
                    detail={a.reason ?? undefined}
                    meta={`${a.actor_label} · ${whenText(a.created_at, now)}`}
                  />
                </li>
              ))}
            </ul>
          )}
          <SourceLine className="mt-3">From the admin log, which nobody can change or delete</SourceLine>
        </Card>
      </AdminBody>
    </>
  );
}

function greeting(now: Date): string {
  const h = now.getUTCHours(); // Accra is GMT
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function Todo({ href, icon, count, label, source }: { href: string; icon: IconName; count: number; label: string; source: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-full flex-col rounded-(--radius-card) bg-surface p-4 shadow-card transition-shadow hover:shadow-raised sm:p-5"
      >
        <span className="flex items-center justify-between">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${count ? "bg-warn-bg text-warn-ink" : "bg-good-bg text-good-ink"}`}>
            <Icon name={count ? icon : "check"} className="h-5 w-5" />
          </span>
          <Icon name="chevron" className="h-5 w-5 text-brand" />
        </span>
        <span className="mt-4 text-display">{count.toLocaleString("en-GB")}</span>
        <span className="mt-1 text-small font-semibold">{label}</span>
        <span className="mt-2 text-small text-muted">{source}</span>
      </Link>
    </li>
  );
}
