import { Icon } from "@/components/ui/Icon";
import { demoSignIn } from "@/lib/auth/actions";
import type { DemoAccount } from "@/lib/auth/demo";

/** Phase 1 sign-in: one button for a seeded demo account, clearly marked as demo-only. */
export function DemoLogin({
  account,
  who,
  next,
  enabled,
}: {
  account: DemoAccount["key"];
  /** "Akoma Mission Hospital front desk (Esi)" */
  who: string;
  next: string;
  enabled: boolean;
}) {
  return (
    <main className="space-y-4 px-4 py-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Sign in</h2>
        <p className="mt-2 text-ink/80">
          In the pilot, staff sign in with a code sent to their phone or email. This pitch demo has one demo account instead.
        </p>
        {enabled ? (
          <form action={demoSignIn} className="mt-4">
            <input type="hidden" name="account" value={account} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="min-h-14 w-full rounded-2xl bg-brand px-4 text-lg font-bold text-white">
              Demo login
            </button>
            <p className="mt-2 text-center text-sm text-ink/70">as {who}</p>
          </form>
        ) : (
          <p className="mt-4 font-semibold">Staff sign-in opens in the pilot.</p>
        )}
      </section>
      <p className="flex gap-3 rounded-2xl border-2 border-dashed border-refused/50 bg-refused-bg p-4 text-refused-ink">
        <Icon name="alert" className="mt-0.5 h-5 w-5" />
        <span>
          <strong>Demo only.</strong> Anyone with this page can use the demo account. It works only on sample data and
          is switched off before real hospitals join.
        </span>
      </p>
    </main>
  );
}
