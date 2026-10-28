"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, describedBy, inputClass } from "@/components/ui/Field";
import { parseLocation } from "@/lib/admin/location";
import { ANSWER_TEXT, ANSWERED_ROLES, CALL_ANSWERS, type CallFormState } from "@/lib/calls/input";
import type { CallAnswer } from "@/lib/db/types";
import { MapPreview } from "./LocationForm";

type Action = (prev: CallFormState, fd: FormData) => Promise<CallFormState>;
type Option = { id: string; label: string };

const SEGMENT =
  "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-4px)] px-3 text-small font-semibold text-muted whitespace-nowrap transition-colors has-[:checked]:bg-brand has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";

/**
 * /admin/calls/new (Prompt 10b): one call to a real facility. Who answered is a role only (rule 2).
 * Every card is asked about in turn; "Not asked" is the default, so nothing is claimed by accident.
 */
export function CallForm({
  action,
  facility,
  cards,
  services,
  callers,
  me,
  nowLocal,
  canSave,
}: {
  action: Action;
  facility: { id: string; name: string };
  cards: Option[];
  services: Option[];
  callers: Option[];
  /** The signed-in admin, the caller by default. */
  me: string | null;
  /** "YYYY-MM-DDTHH:MM" in Accra time, the default call time. */
  nowLocal: string;
  canSave: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [answers, setAnswers] = useState<Record<string, CallAnswer>>(() => Object.fromEntries(cards.map((c) => [c.id, "not_asked"])));
  const [location, setLocation] = useState("");
  const f = state?.fields ?? {};
  const v = state?.values ?? {};
  const loc = location.trim() ? parseLocation(location) : null;

  return (
    // React resets a form after its action, so a failed check gives back what was typed (state.values)
    // and the fields start from it again. Card answers and the location are kept in state.
    <form action={formAction} className="space-y-4 lg:space-y-5" key={JSON.stringify(v)}>
      <input type="hidden" name="facility" value={facility.id} />
      {state?.error && (
        <p role="alert" className="rounded-(--radius-card) bg-danger-bg p-4 font-semibold text-danger-ink">
          {state.error}
        </p>
      )}

      <Card title="The call" titleId="the-call" divided>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="called_at" label="When" error={f.called_at}>
            <input
              id="called_at"
              name="called_at"
              type="datetime-local"
              defaultValue={v.called_at ?? nowLocal}
              required
              aria-invalid={f.called_at ? true : undefined}
              aria-describedby={describedBy("called_at", null, f.called_at)}
              className={inputClass(Boolean(f.called_at))}
            />
          </Field>
          <Field id="caller" label="Who called" error={f.caller}>
            <select
              id="caller"
              name="caller"
              defaultValue={v.caller ?? me ?? ""}
              required
              aria-invalid={f.caller ? true : undefined}
              aria-describedby={describedBy("caller", null, f.caller)}
              className={inputClass(Boolean(f.caller))}
            >
              <option value="" disabled>
                Choose the admin account
              </option>
              {callers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="answered_role" label="Who answered" hint="A role only, never a name." error={f.answered_role}>
            <input
              id="answered_role"
              name="answered_role"
              list="answered-roles"
              defaultValue={v.answered_role}
              autoComplete="off"
              required
              maxLength={60}
              aria-invalid={f.answered_role ? true : undefined}
              aria-describedby={describedBy("answered_role", true, f.answered_role)}
              className={inputClass(Boolean(f.answered_role))}
            />
            <datalist id="answered-roles">
              {ANSWERED_ROLES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <Field id="phone" label="Number reached" hint="Saved on the facility, so patients can call it." error={f.phone}>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="030 222 1234"
              defaultValue={v.phone}
              required
              aria-invalid={f.phone ? true : undefined}
              aria-describedby={describedBy("phone", true, f.phone)}
              className={inputClass(Boolean(f.phone))}
            />
          </Field>
        </div>
      </Card>

      <Card title="Cards" titleId="cards" aside="Ask about each one" divided>
        <ul className="divide-y divide-line">
          {cards.map((c) => {
            const id = `answer-${c.id}`;
            const err = f[id];
            const answer = answers[c.id];
            return (
              <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                <fieldset aria-describedby={err ? `${id}-error` : undefined}>
                  <legend className="font-semibold">{c.label}</legend>
                  <div className="mt-2 flex flex-wrap gap-1 rounded-(--radius-control) border border-line-strong p-1 sm:inline-flex">
                    {CALL_ANSWERS.map((a) => (
                      <label key={a} className={SEGMENT}>
                        <input
                          type="radio"
                          name={id}
                          value={a}
                          checked={answer === a}
                          onChange={() => setAnswers((prev) => ({ ...prev, [c.id]: a }))}
                          className="sr-only"
                        />
                        {ANSWER_TEXT[a]}
                      </label>
                    ))}
                  </div>
                  {answer !== "not_asked" && (
                    <div className="mt-2">
                      <label htmlFor={`note-${c.id}`} className="text-small font-semibold">
                        {answer === "partial" ? "What is partial? (needed)" : "Note (optional)"}
                      </label>
                      <input
                        id={`note-${c.id}`}
                        name={`note-${c.id}`}
                        maxLength={120}
                        defaultValue={v[`note-${c.id}`]}
                        placeholder={answer === "partial" ? "e.g. top-up for scans" : ""}
                        required={answer === "partial"}
                        className={`${inputClass(Boolean(err))} mt-1`}
                      />
                    </div>
                  )}
                  {err && (
                    <p id={`${id}-error`} className="mt-1.5 text-small font-semibold text-danger-ink">
                      {err}
                    </p>
                  )}
                </fieldset>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Also learned" titleId="also" aside="Optional" divided>
        <div className="space-y-4">
          <fieldset aria-describedby={f.services ? "services-error" : undefined}>
            <legend className="font-semibold">Services offered</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-control) border border-line-strong px-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                >
                  <input type="checkbox" name="services" value={s.id} defaultChecked={state?.services?.includes(s.id)} className="h-5 w-5 accent-[var(--color-brand)]" />
                  {s.label}
                </label>
              ))}
            </div>
            {f.services && (
              <p id="services-error" className="mt-1.5 text-small font-semibold text-danger-ink">
                {f.services}
              </p>
            )}
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="usual_hours" label="Usual opening hours" hint="Saved on each service above." error={f.usual_hours}>
              <input
                id="usual_hours"
                name="usual_hours"
                maxLength={80}
                placeholder="Mon–Sat 8 am to 5 pm"
                defaultValue={v.usual_hours}
                aria-describedby={describedBy("usual_hours", true, f.usual_hours)}
                className={inputClass(Boolean(f.usual_hours))}
              />
            </Field>
            <Field id="location" label="Map location" hint="Latitude, longitude, as copied from a map." error={f.location ?? (loc && !loc.ok ? loc.message : null)}>
              <input
                id="location"
                name="location"
                inputMode="decimal"
                autoComplete="off"
                placeholder="5.5612, -0.2601"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                aria-describedby={describedBy("location", true, f.location ?? (loc && !loc.ok ? loc.message : null))}
                className={inputClass(Boolean(f.location) || Boolean(loc && !loc.ok))}
              />
            </Field>
          </div>
          {loc?.ok && <MapPreview lat={loc.lat} lng={loc.lng} name={facility.name} />}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || !canSave} icon="check">
          {pending ? "Saving…" : "Save the call"}
        </Button>
        {!canSave && <p className="text-small text-muted">Demo login: you can look, not save.</p>}
      </div>
    </form>
  );
}
