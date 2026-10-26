import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SourceLine } from "@/components/ui/SourceLine";
import { actionText } from "@/lib/admin/log";
import type { AdminActionRow, ProfileRow } from "@/lib/db/types";
import { whenText } from "@/lib/view/when";

/** An account's state in words: active, not signed in yet (one-time password not used), or switched off. */
export function accountStatus(p: Pick<ProfileRow, "disabled_at" | "must_change_password">) {
  if (p.disabled_at) return <Badge tone="danger">Switched off</Badge>;
  if (p.must_change_password) return <Badge tone="warn">Not signed in yet</Badge>;
  return <Badge tone="good">Active</Badge>;
}

/** The admin log for one hospital or account, newest first: who, what, when and why. */
export function AdminHistory({ actions, now }: { actions: AdminActionRow[]; now: Date }) {
  if (actions.length === 0) return <EmptyState icon="history" title="No admin actions yet" />;
  return (
    <>
      <ol className="relative space-y-4 border-l-2 border-line pl-5" aria-label="History, newest first">
        {actions.map((a) => (
          <li key={a.id} className="relative">
            <span aria-hidden="true" className="absolute top-1.5 -left-[1.6rem] h-3 w-3 rounded-full border-2 border-surface bg-brand" />
            <p className="font-semibold">{actionText(a.action)}</p>
            {a.reason && <p className="text-ink">&ldquo;{a.reason}&rdquo;</p>}
            {typeof a.details?.known_number === "string" && <p className="text-sm text-muted">Called back on {a.details.known_number}</p>}
            <p className="text-sm text-muted">
              {a.actor_label} · {whenText(a.created_at, now)}
            </p>
          </li>
        ))}
      </ol>
      <SourceLine className="mt-4">From the admin log, which nobody can change or delete</SourceLine>
    </>
  );
}
