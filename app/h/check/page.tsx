import type { Metadata } from "next";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { StaffBody, StaffPageHeader, StaffShell } from "@/components/staff/StaffShell";
import type { NavItem } from "@/components/staff/StaffNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Toast } from "@/components/ui/Toast";
import { staffGate } from "@/lib/auth/session";
import { serviceDb } from "@/lib/db/server";
import { loadMorningCheck } from "@/lib/staff/morning-check";
import type { SearchParams } from "@/lib/view/catalog";
import { accraClock } from "@/lib/view/status";
import { publishAction } from "./actions";

export const metadata: Metadata = { title: "Hospital morning check" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const count = (n = 0, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A segmented control: the options of one service sit in one bordered group (Prompt 10c).
const SEGMENTS = "inline-flex rounded-(--radius-control) border border-line-strong bg-surface p-0.5";
const SEGMENT =
  "inline-flex min-h-11 cursor-pointer items-center rounded-[0.625rem] px-4 font-semibold text-muted transition-colors hover:text-ink has-[:checked]:bg-brand has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";
const TIME = "min-h-11 rounded-(--radius-control) border border-line-strong bg-surface px-3 text-body";
const CARD_ANSWERS = [
  { says: "accepts", label: "Yes" },
  { says: "partial", label: "With top-ups" },
  { says: "does_not", label: "No" },
] as const;
const PATH = "/h/check";
const NAV: NavItem[] = [{ href: PATH, label: "Morning check", icon: "check" }];

// Screen 16 (rule M). Hospital staff sign in with their account; the demo login (Akoma) is for rehearsals.
export default async function MorningCheckPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const gate = await staffGate("hospital", PATH);
  if (!gate.ok) return <StaffGateScreen role="hospital" staff={gate.staff} path={PATH} />;
  const { staff } = gate;

  const sp = await searchParams;
  const now = new Date();
  const view = staff.facilityId ? await loadMorningCheck(await serviceDb(), staff.facilityId, now) : null;
  const published = first(sp.published)?.split(".").map(Number);
  const error = first(sp.error);
  const passwordSet = first(sp.password) === "set";

  if (!view) {
    return (
      <StaffShell staff={staff} area="hospitals" nav={NAV} signOutTo={PATH}>
        <StaffPageHeader title="Morning check" narrow />
        <StaffBody narrow>
          <Card>
            <EmptyState icon="info" title="Not linked to a hospital">
              Ask a Veriq admin to link your account.
            </EmptyState>
          </Card>
        </StaffBody>
      </StaffShell>
    );
  }

  return (
    <StaffShell staff={staff} area="hospitals" nav={NAV} signOutTo={PATH}>
      {/* Rule 1: the demo login acts on the demo hospital (Akoma) only. */}
      <StaffPageHeader title="Morning check" description={view.facilityName} sample={staff.kind === "demo"} narrow />
      <StaffBody narrow>
        {passwordSet && <Toast>Your password is saved.</Toast>}
        {published && (
          <Toast>
            Published at {accraClock(now.toISOString())}. Patients see it now. {count(published[0], "service")},{" "}
            {count(published[1], "card")}, {count(published[2], "answer")}.
          </Toast>
        )}
        {error && <Toast tone="error">{error}</Toast>}

        {!view.verified && (
          <Card tone="warn">
            <p className="flex items-start gap-3">
              <Icon name="lock" className="mt-0.5 h-5 w-5" />
              <span>
                <strong className="block font-semibold">Waiting for verification</strong>
                <span className="text-small">Veriq will call {view.facilityName} to check. Until then, nothing here is public.</span>
              </span>
            </p>
          </Card>
        )}

        {view.services.length === 0 ? (
          <Card>
            <EmptyState icon="info" title="No services set up yet">
              Veriq will set them up with you.
            </EmptyState>
          </Card>
        ) : (
          <form action={publishAction} className="space-y-4">
            <fieldset disabled={!view.verified} className="space-y-4 disabled:opacity-60">
              <Card as="div">
                <fieldset>
                  <legend className="text-section">Today&apos;s services</legend>
                  <p className="mt-0.5 text-small text-muted">Add a till time if it changes later.</p>
                  <ul className="mt-2 divide-y divide-line">
                    {view.services.map((s) => (
                      <li key={s.serviceId} className="py-3">
                        <fieldset>
                          <legend className="font-semibold">{s.label}</legend>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={SEGMENTS}>
                              {s.options.map((o) => (
                                <label key={o.status} className={SEGMENT}>
                                  <input type="radio" name={`status:${s.serviceId}`} value={o.status} defaultChecked={s.status === o.status} className="sr-only" />
                                  {o.label}
                                </label>
                              ))}
                            </span>
                            {s.options.some((o) => o.status === "from_time") && (
                              <label className="flex items-center gap-2 text-small text-muted">
                                <span className="sr-only">From time for {s.label}</span>
                                <input type="time" name={`time:${s.serviceId}`} defaultValue={s.fromTime ?? "14:00"} className={TIME} />
                              </label>
                            )}
                          </div>
                          {/* Rule F: an optional "till" time, saved as until_time. */}
                          <input type="hidden" name={`status_was:${s.serviceId}`} value={s.status ?? ""} />
                          <input type="hidden" name={`until_was:${s.serviceId}`} value={s.untilTime ?? ""} />
                          <details open={Boolean(s.untilTime)} className="mt-1">
                            <summary className="inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-brand">
                              {s.untilTime ? "Till time" : "Add a till time"}
                            </summary>
                            <label className="flex items-center gap-2 text-small text-muted">
                              <span>Till</span>
                              <span className="sr-only">time for {s.label} (optional)</span>
                              <input type="time" name={`until:${s.serviceId}`} defaultValue={s.untilTime ?? ""} className={TIME} />
                            </label>
                          </details>
                        </fieldset>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              </Card>

              <Card as="div">
                <fieldset>
                  <div className="flex items-baseline justify-between gap-3">
                    <legend className="text-section">Cards you accept</legend>
                    <span className="text-small text-muted">Weekly</span>
                  </div>
                  <ul className="mt-2 divide-y divide-line">
                    {view.cards.map((c) => (
                      <li key={c.insurerId} className="py-3">
                        <fieldset>
                          <legend className="font-semibold">
                            {c.name}
                            <span className={`ml-2 text-small font-normal ${c.due ? "text-warn-ink" : "text-muted"}`}>
                              {c.due ? "Please confirm" : c.confirmedText}
                            </span>
                          </legend>
                          <div className="mt-2">
                            <span className={SEGMENTS}>
                              {CARD_ANSWERS.map((a) => (
                                <label key={a.says} className={SEGMENT}>
                                  <input type="radio" name={`card:${c.insurerId}`} value={a.says} defaultChecked={c.says === a.says} className="sr-only" />
                                  {a.label}
                                </label>
                              ))}
                            </span>
                          </div>
                        </fieldset>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              </Card>

              {view.prompts.map((p) => (
                <fieldset key={`${p.insurerId}:${p.item}`} className="rounded-(--radius-card) bg-warn-bg p-4 text-warn-ink">
                  <legend className="sr-only">Patient reports about top-ups</legend>
                  <p>
                    <strong>{p.count} patients said</strong> they paid GH¢ {p.amountGhs} for a {p.cardName} {p.itemLabel} this
                    week. Is that right?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex min-h-12 cursor-pointer items-center rounded-(--radius-control) border border-warn-ink bg-surface px-4 font-semibold has-[:checked]:bg-warn-ink has-[:checked]:text-white">
                      <input type="radio" name={`prompt:${p.insurerId}:${p.item}`} value="confirm" className="sr-only" />
                      Yes, show it
                    </label>
                    <label className="inline-flex min-h-12 cursor-pointer items-center rounded-(--radius-control) border border-warn-ink bg-surface px-4 font-semibold has-[:checked]:bg-warn-ink has-[:checked]:text-white">
                      <input type="radio" name={`prompt:${p.insurerId}:${p.item}`} value="correct" className="sr-only" />
                      No, we&apos;ll fix it
                    </label>
                  </div>
                  <label className="mt-3 block text-small font-semibold">
                    If not, the right amount (GH¢, 0 if none)
                    <input
                      name={`amount:${p.insurerId}:${p.item}`}
                      inputMode="decimal"
                      autoComplete="off"
                      className="mt-1 block min-h-11 w-40 rounded-(--radius-control) border border-warn-ink/40 bg-surface px-3 text-body text-ink"
                    />
                  </label>
                </fieldset>
              ))}

              <p className="text-center text-small text-muted">{view.reachLastWeek} people found you on Veriq last week</p>

              {/* The single action, always in reach on a phone. */}
              <div className="sticky bottom-0 -mx-4 border-t border-line bg-page/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
                <Button full size="lg">
                  Publish
                </Button>
              </div>
            </fieldset>
          </form>
        )}
      </StaffBody>
    </StaffShell>
  );
}
