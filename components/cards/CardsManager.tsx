"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  CARD_TYPES,
  addCard,
  familyOf,
  listCards,
  monthLabel,
  removeCard,
  renewalReminder,
  setDefaultCard,
  validateCard,
  type SavedCard,
} from "@/lib/local/cards";
import { RenewalNotice } from "./RenewalNotice";

const cardName = (slug: string) => CARD_TYPES.find((c) => c.slug === slug)?.name ?? slug;

const INPUT = "mt-1 block min-h-12 w-full rounded-xl border border-ink/20 bg-white px-4 text-base font-normal";

/** Screen 5. Everything here stays in this phone's IndexedDB (rule 2). */
export function CardsManager() {
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);

  const reload = useCallback(async () => {
    try {
      setCards(await listCards());
    } catch {
      setStorageBlocked(true);
      setCards([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  async function save(form: HTMLFormElement) {
    const data = new FormData(form);
    const input = {
      insurerSlug: String(data.get("insurer") ?? ""),
      last4: String(data.get("last4") ?? "").trim(),
      nickname: String(data.get("nickname") ?? ""),
      expiresOn: String(data.get("expiresOn") ?? "") || null,
      dependants: String(data.get("dependants") ?? "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
    };
    const checked = validateCard(input);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    await addCard(checked.value);
    setError(null);
    setAdding(false);
    await reload();
  }

  if (cards === null) return <p className="mt-6 text-ink/70">Loading your cards…</p>;

  const reminder = renewalReminder(cards, new Date());
  const family = familyOf(cards);

  return (
    <div className="mt-6 space-y-4">
      {storageBlocked && (
        <p role="alert" className="rounded-xl bg-emergency-bg p-4 text-emergency">
          This browser won&apos;t let us save cards on the phone (private mode?). You can still search with any card.
        </p>
      )}

      {cards.length === 0 && !storageBlocked && (
        <p className="rounded-2xl bg-page p-4 text-ink/80">
          No cards yet. Add your card so searches start with it. Only the last 4 digits are kept, on this phone.
        </p>
      )}

      <ul className="space-y-3">
        {cards.map((c) => (
          <li
            key={c.id}
            className={`rounded-2xl p-5 ${c.isDefault ? "bg-brand text-white" : "border border-ink/20 bg-white"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl font-extrabold">{cardName(c.insurerSlug)}</h2>
              {c.isDefault && <span className="rounded-lg bg-white px-3 py-1 text-sm font-bold text-brand">DEFAULT</span>}
            </div>
            <p className="mt-3 text-xl font-bold tracking-widest" aria-label={`Card ending ${c.last4}`}>
              •••• •••• {c.last4}
            </p>
            <div className={`mt-3 flex flex-wrap justify-between gap-2 ${c.isDefault ? "text-white/90" : "text-ink/80"}`}>
              <span>
                {c.nickname}
                {c.dependants.length > 0 && ` + ${c.dependants.length} ${c.dependants.length === 1 ? "dependant" : "dependants"}`}
              </span>
              {c.expiresOn && <span>Renew by {monthLabel(c.expiresOn)}</span>}
            </div>
            <div className="mt-3 flex gap-2">
              {!c.isDefault && (
                <button
                  type="button"
                  onClick={async () => {
                    await setDefaultCard(c.id);
                    await reload();
                  }}
                  className="min-h-11 rounded-full border border-brand px-4 font-semibold text-brand"
                >
                  Make default
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Remove the ${cardName(c.insurerSlug)} card ending ${c.last4} from this phone?`)) return;
                  await removeCard(c.id);
                  await reload();
                }}
                className={`min-h-11 rounded-full px-4 font-semibold ${c.isDefault ? "text-white underline" : "text-ink/70 underline"}`}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {family.length > 0 && (
        <section aria-labelledby="family">
          <h2 id="family" className="text-lg font-bold">
            Family
          </h2>
          <ul className="mt-2 space-y-2">
            {family.map((f) => (
              <li key={f.name} className="rounded-2xl bg-page p-4">
                <p className="font-bold">{f.name}</p>
                <p className="text-ink/70">{f.insurerSlugs.map(cardName).join(" · ")} dependant</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RenewalNotice
        reminder={reminder}
        hasNhisWithoutExpiry={cards.some((c) => c.insurerSlug === "nhis" && !c.expiresOn)}
      />

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget);
          }}
          className="space-y-4 rounded-2xl border border-ink/20 p-4"
          noValidate
        >
          <h2 className="text-lg font-bold">Add a card</h2>
          <label className="block text-sm font-semibold">
            Card
            <select name="insurer" defaultValue="nhis" aria-label="Card type" className={INPUT}>
              {CARD_TYPES.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Last 4 digits of the card number
            <input name="last4" inputMode="numeric" autoComplete="off" maxLength={4} pattern="\d{4}" className={INPUT} />
            <span className="mt-1 block font-normal text-ink/70">Only the last 4. We never ask for the full number.</span>
          </label>
          <label className="block text-sm font-semibold">
            Card holder&apos;s name
            <input name="nickname" autoComplete="off" maxLength={30} placeholder="For example, Ama" className={INPUT} />
          </label>
          <label className="block text-sm font-semibold">
            Expiry month (optional)
            <input name="expiresOn" type="month" className={INPUT} />
          </label>
          <label className="block text-sm font-semibold">
            Family on this card (optional)
            <input name="dependants" autoComplete="off" placeholder="For example, Kofi (son), Esi" className={INPUT} />
            <span className="mt-1 block font-normal text-ink/70">Separate names with commas.</span>
          </label>
          {error && (
            <p role="alert" className="font-semibold text-emergency">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button type="submit" className="min-h-12 flex-1 rounded-xl bg-brand font-bold text-white">
              Save on this phone
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="min-h-12 rounded-xl px-4 font-semibold text-ink/70"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        !storageBlocked && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/60 text-lg font-bold text-brand"
          >
            <Icon name="plus" className="h-5 w-5" /> Add a card
          </button>
        )
      )}
    </div>
  );
}
