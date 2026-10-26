import { buttonClass } from "@/components/ui/Button";
import { demoSignIn } from "@/lib/auth/actions";
import type { DemoAccount } from "@/lib/auth/demo";

/** The demo login: rehearsals and tests only, clearly marked, and off on the real site (DEMO_LOGIN=off). */
export function DemoLogin({ account, who, next }: { account: DemoAccount["key"]; who: string; next: string }) {
  return (
    <section aria-labelledby="demo-login" className="rounded-(--radius-card) border-2 border-dashed border-refused/50 bg-refused-bg p-4 text-refused-ink">
      <h2 id="demo-login" className="font-bold">
        Rehearsal only
      </h2>
      <p className="mt-1 text-sm">Uses invented sample hospitals. Switched off on the real site.</p>
      <form action={demoSignIn} className="mt-3">
        <input type="hidden" name="account" value={account} />
        <input type="hidden" name="next" value={next} />
        <button type="submit" className={buttonClass({ variant: "secondary", full: true })}>
          Demo login
        </button>
        <p className="mt-2 text-center text-sm">as {who}</p>
      </form>
    </section>
  );
}
