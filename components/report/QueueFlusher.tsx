"use client";

import { useEffect } from "react";
import { flushQueue } from "@/lib/local/queue";

/** Rule 8: sends reports saved on the phone when the app opens and whenever it comes back online. */
export function QueueFlusher() {
  useEffect(() => {
    const flush = () => {
      flushQueue().catch(() => {
        // IndexedDB unavailable (private mode) or still offline: try again next time.
      });
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);
  return null;
}
