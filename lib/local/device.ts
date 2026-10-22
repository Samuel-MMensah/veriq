// Rule A: a random id for this phone, made once and kept in IndexedDB. The server only ever stores
// its SHA-256 hash with a secret, so it can't be traced back to the phone (rule 2).
import { localDb } from "./db";

const KEY = "deviceId";

export async function getDeviceId(): Promise<string> {
  const db = await localDb();
  const existing = await db.get("meta", KEY);
  if (typeof existing === "string") return existing;
  const id = crypto.randomUUID();
  await db.put("meta", id, KEY);
  return id;
}
