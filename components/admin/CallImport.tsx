"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/Field";
import { Toast } from "@/components/ui/Toast";
import { displayName } from "@/lib/view/names";
import type { ImportState } from "@/app/admin/calls/actions";

type Action = (prev: ImportState, fd: FormData) => Promise<ImportState>;

const STATUS = {
  ok: { text: "Ready", tone: "good" },
  duplicate: { text: "Already saved", tone: "neutral" },
  error: { text: "Fix this", tone: "warn" },
} as const;

/**
 * /admin/calls/import (Prompt 10b, item 5): paper calls, typed into the template. Step 1 previews
 * every row (a dry run: nothing is saved); step 2 saves the ready rows once the preview is clean.
 */
export function CallImport({ preview, save, canSave }: { preview: Action; save: Action; canSave: boolean }) {
  const [checked, previewAction, previewing] = useActionState(preview, null);
  const [saved, saveAction, saving] = useActionState(save, null);
  // A failed save hands back its own preview; otherwise show the latest dry run.
  const state = saved?.preview ? saved : checked;
  const p = state?.preview;

  if (saved?.saved !== undefined && !saved.error) {
    return (
      <div className="space-y-4">
        <Toast>
          Saved {saved.saved} {saved.saved === 1 ? "call" : "calls"}
          {saved.skipped ? `; ${saved.skipped} already saved, skipped` : ""}. Badges update now.
        </Toast>
        <Button href="/admin/calls" variant="secondary">
          See the calls
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <Card title="1. Choose the file" titleId="choose" divided>
        <form action={previewAction} className="space-y-4">
          <Field id="file" label="CSV file" hint="Start from the template, so the columns match.">
            <input id="file" name="file" type="file" accept=".csv,text/csv" className={`${inputClass()} py-2.5`} />
          </Field>
          <Field id="csv" label="Or paste the rows" hint="With the header row first.">
            <textarea id="csv" name="csv" rows={5} defaultValue="" className={`${inputClass()} py-2 font-mono text-small`} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={previewing} variant="secondary" icon="search">
              {previewing ? "Checking…" : "Preview"}
            </Button>
            <a href="/admin/calls/template" download className="inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:underline">
              Download the template
            </a>
          </div>
        </form>
      </Card>

      {(Boolean(state?.error) || Boolean(p?.fileErrors.length)) && (
        <Toast tone="error">{state?.error ?? p!.fileErrors.join(" ")}</Toast>
      )}

      {p && p.rows.length > 0 && (
        <Card title="2. Check the preview" titleId="preview" aside={`${p.ready} ready of ${p.rows.length}`} divided>
          <ul className="divide-y divide-line">
            {p.rows.map((r) => (
              <li key={r.line} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="font-semibold">
                    Line {r.line} · {r.facilityName ? displayName(r.facilityName) : "No facility"}
                  </p>
                  <p className="text-small text-muted">{r.calledAt || "No time"}</p>
                  {r.errors.length > 0 && (
                    <ul className={`mt-1 text-small ${r.status === "error" ? "text-warn-ink" : "text-muted"}`}>
                      {r.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].text}</Badge>
              </li>
            ))}
          </ul>
          <form action={saveAction} className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <input type="hidden" name="csv" value={state?.csv ?? ""} />
            <Button disabled={!p.canSave || saving || !canSave} icon="check">
              {saving ? "Saving…" : `Save ${p.ready} ${p.ready === 1 ? "call" : "calls"}`}
            </Button>
            <p className="text-small text-muted">
              {!canSave
                ? "Demo login: you can look, not save."
                : p.canSave
                  ? "Nothing is saved until you press this."
                  : p.ready === 0
                    ? "No new calls to save."
                    : "Fix every row marked “Fix this”, then preview again."}
            </p>
          </form>
        </Card>
      )}
    </div>
  );
}
