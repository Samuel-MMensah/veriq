"use client";

import { deleteDB } from "idb";
import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { LOCAL_STORAGE_KEYS, clearSeenCookie } from "@/lib/local/prefs";

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
            clearSeenCookie();
            for (const key of LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
            await deleteDB("veriq");
          } catch {
            // Storage blocked: nothing was kept anyway.
          }
          setDone(true);
        }}
        className={buttonClass({ variant: "secondary", full: true })}
      >
        Make this phone fresh
      </button>
      {done && (
        <p role="status" className="mt-2 text-small font-semibold text-good-ink">
          Done. Open the app&apos;s start page to see first open again.
        </p>
      )}
    </div>
  );
}
