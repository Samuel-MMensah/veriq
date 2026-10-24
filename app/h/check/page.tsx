import type { Metadata } from "next";
import { DemoLogin } from "@/components/staff/DemoLogin";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { Icon } from "@/components/ui/Icon";
import { currentStaff, demoLoginEnabled } from "@/lib/auth/session";
import { serviceDb } from "@/lib/db/server";
import { loadMorningCheck } from "@/lib/staff/morning-check";
import { accraClock } from "@/lib/view/status";
import type { SearchParams } from "@/lib/view/catalog";
import { publishAction } from "./actions";

export const metadata: Metadata = { title: "Hospital morning check" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const count = (n = 0, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const SEGMENT =
  "inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-ink/20 bg-white px-4 font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";
const CARD_ANSWERS = [
  { says: "accepts", label: "Yes" },
  { says: "partial", label: "With top-ups" },
  { says: "does_not", label: "No" },
] as const;

// Screen 16 (rule M). Phase 1: Akoma's front desk through the demo login.
export default async function MorningCheckPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await currentStaff();
  if (staff?.role !== "hospital") {
    return (
      <>
        <StaffHeader product="hospitals" staff={null} title="Morning check" subtitle="About 30 seconds a day" path="/h/check" />
        <DemoLogin account="hospital-akoma" who="Akoma Mission Hospital front desk (Esi)" next="/h/check" enabled={demoLoginEnabled()} />
      </>
    );
  }

  const sp = await searchParams;
  const db = await serviceDb();
  const now = new Date();
  const view = await loadMorningCheck(db, staff.facilityId, now);
  if (!view) throw new Error("The demo hospital is missing from the data. Re-run the seed.");
  const published = first(sp.published)?.split(".").map(Number);
  const error = first(sp.error);

  return (
    <>
      <StaffHeader
        product="hospitals"
        staff={staff}
        title="Morning check"
        subtitle={`${view.facilityName} · about 30 seconds`}
        path="/h/check"
      />
      <main className="px-4 py-4">
        {published && (
          <p role="status" className="mb-4 flex gap-3 rounded-2xl bg-brand/10 p-4 font-semibold text-brand">
            <Icon name="check" className="mt-0.5 h-5 w-5" />
            Published at {accraClock(now.toISOString())}. Patients see it now. ({count(published[0], "service")} updated,{" "}
            {count(published[1], "card")} confirmed, {count(published[2], "answer")})
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 rounded-2xl bg-emergency-bg p-4 font-semibold text-emergency">
            {error}
          </p>
        )}

        <form action={publishAction} className="space-y-4">
          <fieldset className="rounded-2xl bg-white p-4 shadow-sm">
            <legend className="sr-only">Today&apos;s services</legend>
            <ul className="divide-y divide-ink/10">
              {view.services.map((s) => (
                <li key={s.serviceId} className="py-3">
                  <fieldset>
                    <legend className="text-lg font-semibold">{s.label}</legend>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {s.options.map((o) => (
                        <label key={o.status} className={SEGMENT}>
                          <input
                            type="radio"
                            name={`status:${s.serviceId}`}
                            value={o.status}
                            defaultChecked={s.status === o.status}
                            className="sr-only"
                          />
                          {o.label}
                        </label>
                      ))}
                      {s.options.some((o) => o.status === "from_time") && (
                        <label className="flex items-center gap-2 text-sm text-ink/80">
                          <span className="sr-only">Time for {s.label}</span>
                          <input
                            type="time"
                            name={`time:${s.serviceId}`}
                            defaultValue={s.fromTime ?? "14:00"}
                            className="min-h-11 rounded-xl border border-ink/20 bg-white px-3 text-base"
                          />
                        </label>
                      )}
                    </div>
                  </fieldset>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <legend className="text-lg font-bold">Cards you accept</legend>
              <span className="text-sm text-ink/70">Weekly check</span>
            </div>
            <ul className="mt-2 divide-y divide-ink/10">
              {view.cards.map((c) => (
                <li key={c.insurerId} className="py-3">
                  <fieldset>
                    <legend className="font-semibold">
                      {c.name}
                      <span className={`ml-2 text-sm font-normal ${c.due ? "text-refused-ink" : "text-ink/70"}`}>
                        {c.due ? "Please confirm" : c.confirmedText}
                      </span>
                    </legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {CARD_ANSWERS.map((a) => (
                        <label key={a.says} className={SEGMENT}>
                          <input
                            type="radio"
                            name={`card:${c.insurerId}`}
                            value={a.says}
                            defaultChecked={c.says === a.says}
                            className="sr-only"
                          />
                          {a.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </li>
              ))}
            </ul>
          </fieldset>

          {view.prompts.map((p) => (
            <fieldset key={`${p.insurerId}:${p.item}`} className="rounded-2xl bg-refused-bg p-4 text-refused-ink">
              <legend className="sr-only">Patient reports about top-ups</legend>
              <p className="text-lg">
                <strong>{p.count} patients said</strong> they paid GH¢ {p.amountGhs} for a {p.cardName} {p.itemLabel} this
                week. Is that right?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex min-h-12 cursor-pointer items-center rounded-xl border border-refused-ink bg-white px-4 font-bold has-[:checked]:bg-refused-ink has-[:checked]:text-white">
                  <input type="radio" name={`prompt:${p.insurerId}:${p.item}`} value="confirm" className="sr-only" />
                  Yes, show it
                </label>
                <label className="inline-flex min-h-12 cursor-pointer items-center rounded-xl border border-refused-ink bg-white px-4 font-bold has-[:checked]:bg-refused-ink has-[:checked]:text-white">
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
                  className="mt-1 block min-h-11 w-40 rounded-xl border border-refused-ink/40 bg-white px-3 text-base text-ink"
                />
              </label>
            </fieldset>
          ))}

          <p className="text-center text-ink/80">{view.reachLastWeek} people found you on Veriq last week</p>

          <button type="submit" className="min-h-14 w-full rounded-2xl bg-brand text-lg font-bold text-white">
            Confirm and publish
          </button>
        </form>
      </main>
    </>
  );
}
