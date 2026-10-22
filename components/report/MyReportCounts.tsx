"use client";

import { useEffect, useState } from "react";
import { myReportCounts } from "@/lib/local/queue";

/** Screen 11: this phone's own report counts, read from IndexedDB (never from the server). */
export function MyReportCounts() {
  const [counts, setCounts] = useState<{ sent: number; waiting: number } | null>(null);

  useEffect(() => {
    let alive = true;
    myReportCounts()
      .then((c) => alive && setCounts(c))
      .catch(() => alive && setCounts(null));
    return () => {
      alive = false;
    };
  }, []);

  if (!counts) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-ink/15 p-4">
        <p className="text-3xl font-extrabold text-brand">{counts.sent}</p>
        <p className="text-ink/80">{counts.sent === 1 ? "report" : "reports"} from you</p>
      </div>
      <div className="rounded-2xl border border-ink/15 p-4">
        <p className="text-3xl font-extrabold text-brand">{counts.waiting}</p>
        <p className="text-ink/80">waiting to send</p>
      </div>
    </div>
  );
}
