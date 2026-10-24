// The phone's own storage (IndexedDB through `idb`). Nothing here leaves the phone except queued
// reports, which carry no name or card number (rule 2). Saved cards never leave the phone.
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

/** Screen 5. Only the last 4 digits, never the full number (rule 2). */
export type SavedCard = {
  id: string;
  insurerSlug: string;
  last4: string;
  /** Who holds it, e.g. "Ama". */
  nickname: string;
  /** "YYYY-MM": valid until the end of that month. */
  expiresOn: string | null;
  /** Nicknames of people covered on this card, e.g. "Kofi (son)". */
  dependants: string[];
  isDefault: boolean;
  addedAt: string;
};

interface VeriqLocal extends DBSchema {
  meta: { key: string; value: string | number };
  queue: { key: string; value: QueuedReport };
  cards: { key: string; value: SavedCard };
}

const NAME = "veriq";
const VERSION = 2;
let opened: Promise<IDBPDatabase<VeriqLocal>> | null = null;

export function localDb(): Promise<IDBPDatabase<VeriqLocal>> {
  opened ??= openDB<VeriqLocal>(NAME, VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("meta");
        db.createObjectStore("queue", { keyPath: "key" });
      }
      if (oldVersion < 2) db.createObjectStore("cards", { keyPath: "id" });
    },
  });
  return opened;
}

export async function resetLocalDbForTests(): Promise<void> {
  if (opened) (await opened).close();
  opened = null;
  await deleteDB(NAME);
}
