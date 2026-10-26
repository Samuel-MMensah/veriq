// What an admin form action returns to the screen (useActionState).
export type ActionState = {
  error?: string;
  message?: string;
  /** Shown once, e.g. a one-time password to hand over by hand. */
  secret?: { label: string; value: string };
} | null;
