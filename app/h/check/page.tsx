import type { Metadata } from "next";
import { StaffGateScreen } from "@/components/staff/StaffGateScreen";
import { StaffHeader } from "@/components/staff/StaffHeader";
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

const SEGMENT =
  "inline-flex min-h-11 cursor-pointer items-center rounded-(--radius-control) border border-line-strong bg-surface px-4 font-semibold transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";
const TIME = "min-h-11 rounded-(--radius-control) border border-line-strong bg-surface px-3 text-base";
const CARD_ANSWERS = [
  { says: "accepts", label: "Yes" },
  { says: "partial", label: "With top-ups" },
  { says: "does_not", label: "No" },
] as const;
const PATH = "/h/check";

// Screen 16 (rule M). Hospital staff sign in with their account; the demo login (Akoma) is for rehearsals.
export default async function MorningCheckPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const gate = await staffGate("hospital", PATH);
  if (!gate.ok) return <StaffGateScreen role="hospital" staff={gate.staff} title="Morning check" subtitle="About 30 seconds a day" path={PATH} />;
  const { staff } = gate;

  const sp = await searchParams;
  const now = new Date();
  const view = staff.facilityId ? await loadMorningCheck(await serviceDb(), staff.facilityId, now) : null;
  const published = first(sp.published)?.split(".").map(Number);
  const error = first(sp.error);
  const passwordSet = first(sp.password) === "set";

  if (!view) {
    return (
      <>
        <StaffHeader product="hospitals" staff={staff} title="Morning check" path={PATH} />
        <main className="px-4 py-6">
          <Card>
            <EmptyState icon="info" title="Your account isn't linked to a hospital">
              Ask a Veriq admin to link it to your hospital.
            </EmptyState>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <StaffHeader product="hospitals" staff={staff} title="Morning check" subtitle={`${view.facilityName} · about 30 seconds`} path={PATH} />
      <main className="space-y-4 px-4 py-4">
        {passwordSet && <Toast>Your password is saved.</Toast>}
        {published && (
          <Toast>
            Published at {accraClock(now.toISOString())}. Patients see it now. ({count(published[0], "service")} confirmed,{" "}
            {count(published[1], "card")} checked, {count(published[2], "answer")})
          </Toast>
        )}
        {error && <Toast tone="error">{error}</Toast>}

        {!view.verified && (
          <Card tone="warn">
            <p className="flex items-start gap-3">
              <Icon name="lock" className="mt-0.5 h-5 w-5" />
              <span>
                <strong className="block">Waiting for verification</strong>
                Veriq will call {view.facilityName} back on a number we find ourselves, to check you work there. After
                that you can publish. Until then, patients don&apos;t see anything from this page.
              </span>
            </p>
          </Card>
        )}

        {view.services.length === 0 ? (
          <Card>
            <EmptyState icon="info" title="No services set up yet">
              The NHIA list doesn&apos;t say which services you offer. Veriq will set them up with you.
            </EmptyState>
          </Card>
        ) : (
          <form action={publishAction} className="space-y-4">
            <fieldset disabled={!view.verified} className="space-y-4 disabled:opacity-60">
              <Card as="div">
                <fieldset>
                  <legend className="text-lg font-bold">Today&apos;s services</legend>
                  <p className="mt-0.5 text-sm text-muted">If something changes later today, add a till time, e.g. open till 4 pm.</p>
                  <ul className="mt-2 divide-y divide-line">
                    {view.services.map((s) => (
                      <li key={s.serviceId} className="py-3">
                        <fieldset>
                          <legend className="font-semibold">{s.label}</legend>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {s.options.map((o) => (
                              <label key={o.status} className={SEGMENT}>
                                <input type="radio" name={`status:${s.serviceId}`} value={o.status} defaultChecked={s.status === o.status} className="sr-only" />
                                {o.label}
                              </label>
                            ))}
                            {s.options.some((o) => o.status === "from_time") && (
                              <label className="flex items-center gap-2 text-sm text-muted">
                                <span className="sr-only">From time for {s.label}</span>
                                <input type="time" name={`time:${s.serviceId}`} defaultValue={s.fromTime ?? "14:00"} className={TIME} />
                              </label>
                            )}
                          </div>
                          {/* Rule F: an optional "till" time, saved as until_time. */}
                          <input type="hidden" name={`status_was:${s.serviceId}`} value={s.status ?? ""} />
                          <input type="hidden" name={`until_was:${s.serviceId}`} value={s.untilTime ?? ""} />
                          <details open={Boolean(s.untilTime)} className="mt-1">
                            <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand">
                              {s.untilTime ? "Till time" : "Add a till time"}
                            </summary>
                            <label className="flex items-center gap-2 text-sm text-muted">
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
                    <legend className="text-lg font-bold">Cards you accept</legend>
                    <span className="text-sm text-muted">Weekly check</span>
                  </div>
                  <ul className="mt-2 divide-y divide-line">
                    {view.cards.map((c) => (
                      <li key={c.insurerId} className="py-3">
                        <fieldset>
                          <legend className="font-semibold">
                            {c.name}
                            <span className={`ml-2 text-sm font-normal ${c.due ? "text-refused-ink" : "text-muted"}`}>
                              {c.due ? "Please confirm" : c.confirmedText}
                            </span>
                          </legend>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {CARD_ANSWERS.map((a) => (
                              <label key={a.says} className={SEGMENT}>
                                <input type="radio" name={`card:${c.insurerId}`} value={a.says} defaultChecked={c.says === a.says} className="sr-only" />
                                {a.label}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              </Card>

              {view.prompts.map((p) => (
                <fieldset key={`${p.insurerId}:${p.item}`} className="rounded-(--radius-card) bg-refused-bg p-4 text-refused-ink">
                  <legend className="sr-only">Patient reports about top-ups</legend>
                  <p className="text-lg">
                    <strong>{p.count} patients said</strong> they paid GH¢ {p.amountGhs} for a {p.cardName} {p.itemLabel} this
                    week. Is that right?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex min-h-12 cursor-pointer items-center rounded-(--radius-control) border border-refused-ink bg-surface px-4 font-bold has-[:checked]:bg-refused-ink has-[:checked]:text-white">
                      <input type="radio" name={`prompt:${p.insurerId}:${p.item}`} value="confirm" className="sr-only" />
                      Yes, show it
                    </label>
                    <label className="inline-flex min-h-12 cursor-pointer items-center rounded-(--radius-control) border border-refused-ink bg-surface px-4 font-bold has-[:checked]:bg-refused-ink has-[:checked]:text-white">
                      <input type="radio" name={`prompt:${p.insurerId}:${p.item}`} value="correct" className="sr-only" />
                      No, we&apos;ll fix it
                    </label>
                  </div>
                  <label className="mt-3 block text-sm font-semibold">
                    If not, the right amount (GH¢, 0 if none)
                    <input
                      name={`amount:${p.insurerId}:${p.item}`}
                      inputMode="decimal"
                      autoComplete="off"
                      className="mt-1 block min-h-11 w-40 rounded-(--radius-control) border border-refused-ink/40 bg-surface px-3 text-base text-ink"
                    />
                  </label>
                </fieldset>
              ))}

              <p className="text-center text-muted">{view.reachLastWeek} people found you on Veriq last week</p>

              <Button full size="lg">
                Confirm and publish
              </Button>
            </fieldset>
          </form>
        )}
      </main>
    </>
  );
}
