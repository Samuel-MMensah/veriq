"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, describedBy, inputClass } from "@/components/ui/Field";
import { passwordSignIn, setOwnPassword, type FormState } from "@/lib/auth/actions";

/** Email and password (Prompt 10). Nothing is sent by email or SMS. */
export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(passwordSignIn, null);
  const error = state?.error;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field id="email" label="Work email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          defaultValue={state?.email ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy("email", null, error)}
          className={inputClass(Boolean(error))}
        />
      </Field>
      <Field id="password" label="Password" error={error}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy("password", null, error)}
          className={inputClass(Boolean(error))}
        />
      </Field>
      <Button full size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

/** First sign-in, or a change: the password you have now, then your own new one twice. */
export function NewPasswordForm({ next, first }: { next: string; first: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setOwnPassword, null);
  const error = state?.error;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field id="current" label={first ? "The password you were given" : "Your password now"}>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={inputClass()} />
      </Field>
      <Field id="new-password" label="New password" hint="At least 10 characters. A short sentence is easy to remember.">
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-describedby={describedBy("new-password", true)}
          className={inputClass(Boolean(error))}
        />
      </Field>
      <Field id="repeat" label="New password again" error={error}>
        <input
          id="repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy("repeat", null, error)}
          className={inputClass(Boolean(error))}
        />
      </Field>
      <Button full size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save my password"}
      </Button>
    </form>
  );
}
