// Screen 5: saved cards live only on the phone (IndexedDB), last 4 digits only (rule 2).
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { addCard, familyOf, listCards, removeCard, renewalReminder, setDefaultCard, validateCard, type CardInput } from "./cards";
import { resetLocalDbForTests } from "./db";

const nhis: CardInput = { insurerSlug: "nhis", last4: "4821", nickname: "Ama", expiresOn: "2027-03", dependants: [] };
const cosmo: CardInput = { insurerSlug: "cosmopolitan", last4: "0193", nickname: "Ama", expiresOn: null, dependants: ["Kofi (son)", "Esi"] };

beforeEach(async () => {
  await resetLocalDbForTests();
});

describe("validateCard (rule 2: last 4 digits only)", () => {
  it("accepts a card with the last 4 digits", () => {
    expect(validateCard(nhis).ok).toBe(true);
    expect(validateCard({ ...nhis, expiresOn: null }).ok).toBe(true);
  });

  it.each([
    ["a full card number", { ...nhis, last4: "12345678" }],
    ["letters", { ...nhis, last4: "48a1" }],
    ["3 digits", { ...nhis, last4: "482" }],
    ["a card number hidden in the nickname", { ...nhis, nickname: "Ama 12345678" }],
    ["a card number hidden in a dependant", { ...nhis, dependants: ["Kofi 0244123456"] }],
    ["an empty nickname", { ...nhis, nickname: "  " }],
    ["a long nickname", { ...nhis, nickname: "A".repeat(31) }],
    ["an unknown card", { ...nhis, insurerSlug: "visa" }],
    ["a bad expiry", { ...nhis, expiresOn: "03/2027" }],
  ])("refuses %s", (_, card) => {
    expect(validateCard(card as CardInput).ok).toBe(false);
  });
});

describe("the card list on the phone", () => {
  it("adds cards; the first becomes the default and comes first", async () => {
    await addCard(cosmo);
    await addCard(nhis);
    const cards = await listCards();
    expect(cards.map((c) => [c.insurerSlug, c.isDefault])).toEqual([
      ["cosmopolitan", true],
      ["nhis", false],
    ]);
    expect(cards[1]).toMatchObject({ last4: "4821", nickname: "Ama", expiresOn: "2027-03" });
  });

  it("can change the default", async () => {
    await addCard(cosmo);
    const n = await addCard(nhis);
    await setDefaultCard(n.id);
    expect((await listCards()).map((c) => [c.insurerSlug, c.isDefault])).toEqual([
      ["nhis", true],
      ["cosmopolitan", false],
    ]);
  });

  it("removing the default makes the next card the default", async () => {
    const c = await addCard(cosmo);
    await addCard(nhis);
    await removeCard(c.id);
    expect((await listCards()).map((x) => [x.insurerSlug, x.isDefault])).toEqual([["nhis", true]]);
  });

  it("refuses to save an invalid card", async () => {
    await expect(addCard({ ...nhis, last4: "12345678" })).rejects.toThrow(/last 4 digits/i);
    expect(await listCards()).toEqual([]);
  });
});

describe("family (dependants)", () => {
  it("lists each dependant with the cards they are on", () => {
    const cards = [
      { ...nhis, id: "a", isDefault: true, addedAt: "", dependants: ["Kofi (son)"] },
      { ...cosmo, id: "b", isDefault: false, addedAt: "" },
    ];
    expect(familyOf(cards)).toEqual([
      { name: "Esi", insurerSlugs: ["cosmopolitan"] },
      { name: "Kofi (son)", insurerSlugs: ["nhis", "cosmopolitan"] },
    ]);
  });
});

describe("NHIS renewal reminder: a month before expiry", () => {
  const card = (expiresOn: string | null) => [{ ...nhis, expiresOn, id: "a", isDefault: true, addedAt: "" }];
  // A card marked "2027-03" is valid until the end of 31 March 2027.
  const at = (iso: string) => new Date(iso);

  it("is 'later' more than a month before", () => {
    expect(renewalReminder(card("2027-03"), at("2027-02-27T12:00:00Z"))).toMatchObject({ state: "later", monthLabel: "Mar 2027" });
  });

  it("is 'due' within a month of the end of the expiry month (threshold: exactly 31 days)", () => {
    expect(renewalReminder(card("2027-03"), at("2027-03-01T00:00:00Z"))?.state).toBe("due");
    expect(renewalReminder(card("2027-03"), at("2027-02-28T23:59:59Z"))?.state).toBe("later");
  });

  it("is 'expired' after the expiry month", () => {
    expect(renewalReminder(card("2027-03"), at("2027-04-01T00:00:00Z"))?.state).toBe("expired");
  });

  it("is null without an NHIS card with an expiry", () => {
    expect(renewalReminder(card(null), at("2027-03-15T00:00:00Z"))).toBeNull();
    expect(renewalReminder([{ ...cosmo, id: "b", isDefault: true, addedAt: "" }], at("2027-03-15T00:00:00Z"))).toBeNull();
  });
});

describe("card data never leaves the phone (rule 2)", () => {
  it("the card store has no way to reach the network", () => {
    const source = readFileSync(join(process.cwd(), "lib/local/cards.ts"), "utf8");
    expect(source).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|supabase|\/api\//);
  });
});
