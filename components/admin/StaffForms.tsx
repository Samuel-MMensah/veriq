"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, describedBy, inputClass } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import type { ActionState } from "@/lib/admin/form";

export type Option = { id: string; label: string; group?: string };
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const ROLES = [
  { value: "hospital", label: "Hospital staff", hint: "Does the morning check for one hospital" },
  { value: "insurer", label: "Insurer staff", hint: "Sees network health for one insurer" },
  { value: "admin", label: "Veriq admin", hint: "Verifies hospitals and manages accounts" },
] as const;

/** Grouped options (facilities by district), so a long list stays findable. */
function Options({ options }: { options: Option[] }) {
  const groups = new Map<string, Option[]>();
  for (const o of options) groups.set(o.group ?? "", [...(groups.get(o.group ?? "") ?? []), o]);
  return (
    <>
      {[...groups].map(([group, list]) =>
        group ? (
          <optgroup key={group} label={group}>
            {list.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ) : (
          list.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))
        ),
      )}
    </>
  );
}

/** The one-time password, shown once, big enough to read out over the phone. */
export function SecretPanel({ state }: { state: NonNullable<ActionState> }) {
  return (
    <div role="status" className="animate-enter rounded-(--radius-card) bg-good-bg p-4 text-good-ink">
      <p className="flex items-center gap-2 font-bold">
        <Icon name="check" className="h-5 w-5" /> {state.message}
      </p>
      {state.secret && (
        <>
          <p className="mt-3 text-sm">{state.secret.label}</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-ink select-all">{state.secret.value}</p>
          <p className="mt-2 text-sm">
            It is shown only now and works once: at first sign-in they choose their own. Don&apos;t send it by email or text.
          </p>
        </>
      )}
    </div>
  );
}

/** /admin/staff: make an account. Nothing is emailed; the admin hands over the one-time password. */
export function CreateAccountForm({ action, facilities, insurers }: { action: Action; facilities: Option[]; insurers: Option[] }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [role, setRole] = useState<string>("hospital");
  const error = state?.error;
  return (
    <div className="space-y-4">
      {state?.secret && <SecretPanel state={state} />}
      <form action={formAction} className="space-y-4" key={state?.secret?.value}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="new-name" label="Name">
            <input id="new-name" name="name" autoComplete="off" required className={inputClass()} />
          </Field>
          <Field id="new-email" label="Work email">
            <input id="new-email" name="email" type="email" inputMode="email" autoComplete="off" required className={inputClass()} />
          </Field>
        </div>
        <fieldset>
          <legend className="font-semibold">What they do</legend>
          <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className="flex min-h-14 cursor-pointer flex-col justify-center rounded-(--radius-control) border border-line-strong px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand"
              >
                <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="sr-only" />
                <span className="font-semibold">{r.label}</span>
                <span className="text-sm text-muted">{r.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {role === "hospital" && (
          <Field id="new-facility" label="Hospital" hint="Real facilities from the NHIA list, by district.">
            <select id="new-facility" name="facility" required defaultValue="" aria-describedby={describedBy("new-facility", true)} className={inputClass()}>
              <option value="" disabled>
                Choose the hospital
              </option>
              <Options options={facilities} />
            </select>
          </Field>
        )}
        {role === "insurer" && (
          <Field id="new-insurer" label="Insurer">
            <select id="new-insurer" name="insurer" required defaultValue="" className={inputClass()}>
              <option value="" disabled>
                Choose the insurer
              </option>
              <Options options={insurers} />
            </select>
          </Field>
        )}
        {error && (
          <p role="alert" className="font-semibold text-danger-ink">
            {error}
          </p>
        )}
        <Button disabled={pending} icon="plus">
          {pending ? "Making the account…" : "Make the account"}
        </Button>
      </form>
    </div>
  );
}

/** /admin/staff/[id]: link a hospital account to its facility, or an insurer account to its insurer. */
export function LinkForm({
  action,
  userId,
  role,
  current,
  options,
}: {
  action: Action;
  userId: string;
  role: "hospital" | "insurer";
  current: string | null;
  options: Option[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const name = role === "hospital" ? "facility" : "insurer";
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="user" value={userId} />
      <Field id="link" label={role === "hospital" ? "Works at" : "Works for"} error={state?.error}>
        <select id="link" name={name} defaultValue={current ?? ""} aria-describedby={describedBy("link", null, state?.error)} className={inputClass(Boolean(state?.error))}>
          <Options options={options} />
        </select>
      </Field>
      {state?.message && (
        <p role="status" className="flex items-center gap-2 font-semibold text-good-ink">
          <Icon name="check" className="h-5 w-5" /> {state.message}
        </p>
      )}
      <Button variant="secondary" disabled={pending}>
        Save link
      </Button>
    </form>
  );
}
