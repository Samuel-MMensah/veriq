"use client";

import { useActionState, useId, useRef } from "react";
import type { ActionState } from "@/lib/admin/form";
import { Button, type ButtonVariant } from "./Button";
import { inputClass } from "./Field";

/**
 * A button that asks first. It opens a dialog (native <dialog>: focus stays inside, Esc closes) that
 * says what will happen and, when needed, asks why. Only then is `action` sent. An error shows in the
 * dialog; a one-time secret (a password to hand over) shows once, in the dialog, after success.
 */
export function ConfirmAction({
  action,
  fields,
  label,
  title,
  body,
  confirmLabel,
  variant = "primary",
  triggerVariant,
  reason,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Hidden inputs sent with the form, e.g. { report: id }. */
  fields: Record<string, string>;
  /** The button that opens the dialog. */
  label: string;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  /** The confirm button inside the dialog. */
  variant?: ButtonVariant;
  /** The button that opens it: secondary unless said otherwise (row actions are never primary). */
  triggerVariant?: ButtonVariant;
  /** Ask why; the answer goes in the admin log. */
  reason?: { label: string; hint?: string; required?: boolean };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [state, formAction, pending] = useActionState(action, null);
  const done = Boolean(state?.secret || state?.message);
  return (
    <>
      <Button type="button" variant={triggerVariant ?? "secondary"} onClick={() => ref.current?.showModal()}>
        {label}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-(--radius-card) bg-surface p-0 text-ink shadow-raised open:animate-enter"
      >
        {done ? (
          <div className="space-y-4 p-5">
            <h2 id={`${id}-title`} className="text-section">
              {state?.message ?? "Done"}
            </h2>
            {state?.secret && (
              <div className="rounded-(--radius-control) bg-brand-soft p-4">
                <p className="text-small text-muted">{state.secret.label}</p>
                <p className="mt-1 font-mono text-title tracking-wide select-all">{state.secret.value}</p>
                <p className="mt-2 text-small text-muted">It is shown only now. It works once; the person then sets their own.</p>
              </div>
            )}
            <Button type="button" full onClick={() => ref.current?.close()}>
              Close
            </Button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4 p-5">
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <h2 id={`${id}-title`} className="text-section">
              {title}
            </h2>
            <div className="text-muted">{body}</div>
            {reason && (
              <div>
                <label htmlFor={`${id}-reason`} className="block font-semibold">
                  {reason.label}
                </label>
                {reason.hint && <p className="mt-0.5 text-small text-muted">{reason.hint}</p>}
                <textarea
                  id={`${id}-reason`}
                  name="reason"
                  required={reason.required}
                  minLength={reason.required ? 3 : undefined}
                  rows={3}
                  className={`${inputClass(Boolean(state?.error))} mt-1.5 py-2`}
                />
              </div>
            )}
            {state?.error && (
              <p role="alert" className="text-small font-semibold text-danger-ink">
                {state.error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>
                Cancel
              </Button>
              <Button variant={variant} disabled={pending}>
                {pending ? "Saving…" : confirmLabel}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
