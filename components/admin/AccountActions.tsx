import { ConfirmAction } from "@/components/ui/Dialog";
import { resetPasswordAction, setDisabledAction } from "@/app/admin/actions";

/** Reset password and switch off or on, each after a confirmation. */
export function AccountActions({ userId, email, disabled, isSelf }: { userId: string; email: string; disabled: boolean; isSelf: boolean }) {
  return (
    <div className="grid gap-2">
      <ConfirmAction
        action={resetPasswordAction}
        fields={{ user: userId }}
        label="Reset password"
        title="Reset this password?"
        body={
          <>
            {email}&apos;s password stops working now, and they are signed out everywhere. You get a new one-time password
            to give them by hand or by phone.
          </>
        }
        confirmLabel="Reset password"
        triggerVariant="secondary"
        reason={{ label: "Why? (optional)", hint: "For the admin log, e.g. \"Forgot it, called from the front desk\"." }}
      />
      {disabled ? (
        <ConfirmAction
          action={setDisabledAction}
          fields={{ user: userId, disabled: "0" }}
          label="Switch back on"
          title="Switch this account back on?"
          body={<>{email} can sign in again with their password.</>}
          confirmLabel="Switch on"
          triggerVariant="secondary"
          reason={{ label: "Why? (optional)" }}
        />
      ) : (
        !isSelf && (
          <ConfirmAction
            action={setDisabledAction}
            fields={{ user: userId, disabled: "1" }}
            label="Switch off"
            title="Switch this account off?"
            body={<>{email} is signed out at once and can&apos;t sign in or publish anything until an admin switches it back on.</>}
            confirmLabel="Switch off"
            variant="primary"
            reason={{ label: "Why?", hint: "Required, for the admin log.", required: true }}
          />
        )
      )}
    </div>
  );
}
