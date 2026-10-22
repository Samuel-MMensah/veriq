// The phone's own storage (IndexedDB through `idb`). Nothing here leaves the phone except queued
// reports, which carry no name or card number (rule 2). Prompt 6 adds saved cards in version 2.
import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ReportItem, ReportOutcome } from "@/lib/db/types";

export type QueuedReport = {
  /** Sort key: when it was queued, then a counter. */
  key: string;
  facilityId: string;
  insurerId: string;
  outcome: ReportOutcome;
  amountGhs: number | null;
  item: ReportItem | null;
  serviceId: string | null;
  queuedAt: string;
};

interface VeriqLocal extends DBSchema {
  meta: { key: string; value: string | number };
  queue: { key: string; value: QueuedReport };
}

const NAME = "veriq";
const VERSION = 1;
let opened: Promise<IDBPDatabase<VeriqLocal>> | null = null;

export function localDb(): Promise<IDBPDatabase<VeriqLocal>> {
  opened ??= openDB<VeriqLocal>(NAME, VERSION, {
    upgrade(db) {
      db.createObjectStore("meta");
      db.createObjectStore("queue", { keyPath: "key" });
    },
  });
  return opened;
}

export async function resetLocalDbForTests(): Promise<void> {
  if (opened) (await opened).close();
  opened = null;
  await deleteDB(NAME);
}
