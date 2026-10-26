"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, describedBy, inputClass } from "@/components/ui/Field";
import type { ActionState } from "@/lib/admin/form";

const CHECK =
  "flex min-h-14 cursor-pointer items-start gap-3 rounded-(--radius-control) border border-line-strong p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";

/**
 * Verify a hospital's claim (Prompt 10): two checks the admin did themselves, the number they called,
 * then "Mark as verified". The checks are the confirmation.
 */
export function VerifyForm({
  action,
  facilityId,
  nhiaName,
  nhiaRef,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  facilityId: string;
  nhiaName: string;
  nhiaRef: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="facility" value={facilityId} />
      <fieldset className="space-y-2">
        <legend className="font-semibold">Before you verify</legend>
        <label className={CHECK}>
          <input type="checkbox" name="name_matches" className="mt-1 h-5 w-5 accent-brand" />
          <span>
            <span className="block font-semibold">The name matches the NHIA list</span>
            <span className="text-sm break-all text-muted">
              {nhiaName}
              {nhiaRef && <> · {nhiaRef}</>}
            </span>
          </span>
        </label>
        <label className={CHECK}>
          <input type="checkbox" name="called_back" className="mt-1 h-5 w-5 accent-brand" />
          <span>
            <span className="block font-semibold">I called the hospital back</span>
            <span className="text-sm text-muted">On a number I found myself, not one the person gave me, and they confirmed this person works there.</span>
          </span>
        </label>
      </fieldset>
      <Field id="known-number" label="The number you called, and where you found it" hint='e.g. "030 266 1234, Ghana Health Service directory"'>
        <input id="known-number" name="known_number" autoComplete="off" aria-describedby={describedBy("known-number", true)} className={inputClass()} />
      </Field>
      <Field id="note" label="Note (optional)">
        <input id="note" name="note" autoComplete="off" className={inputClass()} />
      </Field>
      {state?.error && (
        <p role="alert" className="font-semibold text-danger-ink">
          {state.error}
        </p>
      )}
      <Button full disabled={pending} icon="shield">
        {pending ? "Saving…" : "Mark as verified"}
      </Button>
    </form>
  );
}
