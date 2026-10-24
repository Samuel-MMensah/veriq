// Screen 5: the person's cards, kept only on this phone in IndexedDB. Rule 2: last 4 digits only,
// and this module never talks to the network. Searches send just the card type (e.g. "nhis").
import { CARD_OPTIONS, CASH } from "@/lib/view/catalog";
import { localDb, type SavedCard } from "./db";

export type { SavedCard } from "./db";
export type CardInput = Pick<SavedCard, "insurerSlug" | "last4" | "nickname" | "expiresOn" | "dependants">;

export const CARD_TYPES = CARD_OPTIONS.filter((c) => c.slug !== CASH);

const NAME = /^[\p{L}][\p{L} .'()-]{0,29}$/u;
/** 5 or more digits in a row looks like a card or phone number. */
const LONG_NUMBER = /\d{5,}/;

type Valid = { ok: true; value: CardInput } | { ok: false; message: string };

export function validateCard(input: CardInput): Valid {
  const bad = (message: string): Valid => ({ ok: false, message });
  if (!CARD_TYPES.some((c) => c.slug === input.insurerSlug)) return bad("Choose your card.");
  if (!/^\d{4}$/.test(input.last4)) return bad("Type only the last 4 digits of the card number.");

  const nickname = input.nickname.trim();
  if (LONG_NUMBER.test(nickname)) return bad("Please don't type a card or phone number in a name.");
  if (!NAME.test(nickname)) return bad("Give the card holder a short name, like Ama.");

  const dependants = input.dependants.map((d) => d.trim()).filter(Boolean);
  if (dependants.some((d) => LONG_NUMBER.test(d))) return bad("Please don't type a card or phone number in a name.");
  if (dependants.some((d) => !NAME.test(d))) return bad("Keep each family name short, like Kofi (son).");

  if (input.expiresOn !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.expiresOn)) return bad("Choose the month the card expires.");
  return { ok: true, value: { insurerSlug: input.insurerSlug, last4: input.last4, nickname, expiresOn: input.expiresOn, dependants } };
}

/** Default card first, then in the order they were added. */
export async function listCards(): Promise<SavedCard[]> {
  const cards = await (await localDb()).getAll("cards");
  return cards.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.addedAt.localeCompare(b.addedAt));
}

export async function addCard(input: CardInput): Promise<SavedCard> {
  const checked = validateCard(input);
  if (!checked.ok) throw new Error(checked.message);
  const db = await localDb();
  const card: SavedCard = {
    ...checked.value,
    id: crypto.randomUUID(),
    isDefault: (await db.count("cards")) === 0,
    addedAt: new Date().toISOString(),
  };
  await db.put("cards", card);
  return card;
}

export async function setDefaultCard(id: string): Promise<void> {
  const db = await localDb();
  const tx = db.transaction("cards", "readwrite");
  for (const card of await tx.store.getAll()) await tx.store.put({ ...card, isDefault: card.id === id });
  await tx.done;
}

export async function removeCard(id: string): Promise<void> {
  const db = await localDb();
  const card = await db.get("cards", id);
  await db.delete("cards", id);
  if (card?.isDefault) {
    const [next] = await listCards();
    if (next) await setDefaultCard(next.id);
  }
}

/** Each dependant once, with the cards they are on (screen 5, "Family"). */
export function familyOf(cards: SavedCard[]): { name: string; insurerSlugs: string[] }[] {
  const byName = new Map<string, string[]>();
  for (const card of cards) {
    for (const name of card.dependants) {
      const slugs = byName.get(name) ?? [];
      if (!slugs.includes(card.insurerSlug)) slugs.push(card.insurerSlug);
      byName.set(name, slugs);
    }
  }
  return [...byName.entries()].map(([name, insurerSlugs]) => ({ name, insurerSlugs })).sort((a, b) => a.name.localeCompare(b.name));
}

export type RenewalReminder = { state: "later" | "due" | "expired"; monthLabel: string };

/** "2027-03" reads "Mar 2027". */
export function monthLabel(expiresOn: string): string {
  const [year, month] = expiresOn.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

const REMIND_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The NHIS card that expires soonest: "due" from a month before the end of its expiry month. */
export function renewalReminder(cards: SavedCard[], now: Date): RenewalReminder | null {
  const nhis = cards
    .filter((c) => c.insurerSlug === "nhis" && c.expiresOn)
    .sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!))[0];
  if (!nhis?.expiresOn) return null;
  const [year, month] = nhis.expiresOn.split("-").map(Number) as [number, number];
  // Valid until the end of the month (Ghana is on UTC).
  const end = Date.UTC(year, month, 1);
  const left = end - now.getTime();
  return {
    state: left <= 0 ? "expired" : left <= REMIND_DAYS * DAY_MS ? "due" : "later",
    monthLabel: monthLabel(nhis.expiresOn),
  };
}
