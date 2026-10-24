"use client";

import { deleteDB } from "idb";
import { useState } from "react";
import { LOCAL_STORAGE_KEYS } from "@/lib/local/prefs";

/** For rehearsals: forget everything this app kept on this phone, so first open shows again. */
export function FreshPhone() {
  const [done, setDone] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          if (!window.confirm("Forget this phone's saved cards, reports waiting to send and settings?")) return;
          try {
            for (const key of LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
            await deleteDB("veriq");
          } catch {
            // Storage blocked: nothing was kept anyway.
          }
          setDone(true);
        }}
        className="min-h-12 w-full rounded-2xl border-2 border-brand px-4 font-bold text-brand"
      >
        Make this phone fresh
      </button>
      {done && (
        <p role="status" className="mt-2 text-sm text-brand">
          Done. Open the app&apos;s start page to see first open again.
        </p>
      )}
    </div>
  );
}
