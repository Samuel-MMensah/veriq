import { buttonClass } from "@/components/ui/Button";
import { demoSignIn } from "@/lib/auth/actions";
import type { DemoAccount } from "@/lib/auth/demo";

/** The demo login: rehearsals and tests only, and off on the real site (DEMO_LOGIN=off). */
export function DemoLogin({ account, who, next }: { account: DemoAccount["key"]; who: string; next: string }) {
  return (
    <form action={demoSignIn} className="text-center">
      <input type="hidden" name="account" value={account} />
      <input type="hidden" name="next" value={next} />
      <button type="submit" className={buttonClass({ variant: "secondary", full: true })}>
        Demo login
      </button>
      <p className="mt-2 text-small text-muted">Rehearsals only, as {who}</p>
    </form>
  );
}
