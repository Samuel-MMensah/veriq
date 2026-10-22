"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ReportItem, ReportOutcome } from "@/lib/db/types";
import { submitOrQueue } from "@/lib/local/queue";

type Card = { id: string; slug: string; name: string };

const ITEMS: { value: ReportItem; label: string }[] = [
  { value: "scan", label: "Scan" },
  { value: "drugs", label: "Drugs" },
  { value: "lab", label: "Lab" },
  { value: "registration", label: "Registration" },
];

const OPTION =
  "block cursor-pointer rounded-2xl border border-ink/20 bg-white p-4 has-[:checked]:border-2 has-[:checked]:border-brand has-[:checked]:bg-brand/10 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";
const RADIO_DOT =
  "h-7 w-7 shrink-0 appearance-none rounded-full border-2 border-ink/30 bg-white checked:border-[9px] checked:border-brand";
const CHIP =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-ink/20 bg-white px-4 has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:font-bold has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";

/** Parses "80", "GH¢ 80" or "80.50". Empty is fine (the amount is optional); anything else is null. */
export function parseCedis(text: string): number | "empty" | null {
  const cleaned = text.replace(/gh¢|ghs|¢|,|\s/gi, "");
  if (cleaned === "") return "empty";
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n <= 100_000 ? n : null;
}

export function ReportForm({
  facilityId,
  cards,
  initialCardId,
}: {
  facilityId: string;
  cards: Card[];
  initialCardId: string;
}) {
  const router = useRouter();
  const [cardId, setCardId] = useState(initialCardId);
  const [outcome, setOutcome] = useState<ReportOutcome | null>(null);
  const [amount, setAmount] = useState("");
  const [item, setItem] = useState<ReportItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [queued, setQueued] = useState(false);
  const card = cards.find((c) => c.id === cardId) ?? cards[0]!;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!outcome || busy) return;
    const parsed = outcome === "topup" ? parseCedis(amount) : "empty";
    if (parsed === null) {
      setNotice({ tone: "error", text: "Enter the amount in cedis, like 80. Or leave it empty." });
      return;
    }
    setBusy(true);
    setNotice(null);
    const result = await submitOrQueue({
      facilityId,
      insurerId: card.id,
      outcome,
      amountGhs: outcome === "topup" && parsed !== "empty" ? parsed : null,
      item: outcome === "topup" ? item : null,
      serviceId: null,
    });
    const base = `/report/thanks?facility=${facilityId}&card=${card.slug}`;
    if (result.kind === "sent") router.push(`${base}&report=${result.reportId}&state=${result.status}`);
    else if (result.kind === "queued") setQueued(true); // offline: no page to load, so confirm here
    else {
      setBusy(false);
      setNotice({ tone: result.kind === "already" ? "info" : "error", text: result.message });
    }
  }

  if (queued) {
    return (
      <div role="status" className="flex flex-1 flex-col">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Icon name="clock" className="h-10 w-10" />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold leading-tight">Saved on your phone.</h1>
        <p className="mt-2 text-lg text-ink/80">
          You&apos;re offline right now. We&apos;ll send your report as soon as you&apos;re back online. Nothing else to do.
        </p>
        <Link
          href={`/facility/${facilityId}?card=${card.slug}`}
          className="mt-auto flex min-h-14 w-full items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white"
        >
          Done
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="flex flex-1 flex-col">
      <h1 className="text-3xl font-extrabold leading-tight">Was your {card.name} card accepted?</h1>
      <p className="mt-2 text-lg text-ink/80">Your answer helps the next person decide where to go. Takes 10 seconds.</p>
      {cards.length > 1 && (
        <label className="mt-3 flex items-center gap-2 text-sm text-ink/80">
          Another card?
          <select
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className="min-h-11 rounded-lg border border-ink/20 bg-white px-3 text-base"
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset className="mt-6 space-y-3">
        <legend className="sr-only">What happened?</legend>
        <label className={OPTION}>
          <span className="flex items-center gap-4">
            <input type="radio" name="outcome" value="covered" checked={outcome === "covered"} onChange={() => setOutcome("covered")} className={RADIO_DOT} />
            <span className="text-lg font-bold">Yes, fully covered</span>
          </span>
        </label>

        <div className={OPTION}>
          <label className="flex cursor-pointer items-center gap-4">
            <input type="radio" name="outcome" value="topup" checked={outcome === "topup"} onChange={() => setOutcome("topup")} className={RADIO_DOT} />
            <span className="text-lg font-bold">Yes, but I paid extra</span>
          </label>
          {outcome === "topup" && (
            <div className="mt-4 space-y-4 pl-11">
              <label className="block text-sm font-semibold text-ink/80">
                How much? (optional)
                <span className="mt-1 flex min-h-12 items-center rounded-xl border border-ink/20 bg-white px-4 text-lg font-normal focus-within:outline focus-within:outline-3 focus-within:outline-brand">
                  <span aria-hidden="true" className="mr-2 text-ink/70">
                    GH¢
                  </span>
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-label="Amount in Ghana cedis"
                    className="w-full bg-transparent outline-none"
                  />
                </span>
              </label>
              <fieldset>
                <legend className="text-sm font-semibold text-ink/80">For what?</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ITEMS.map((i) => (
                    <label key={i.value} className={CHIP}>
                      <input
                        type="radio"
                        name="item"
                        value={i.value}
                        checked={item === i.value}
                        onChange={() => setItem(i.value)}
                        className="sr-only"
                      />
                      {i.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </div>

        <label className={OPTION}>
          <span className="flex items-center gap-4">
            <input type="radio" name="outcome" value="refused" checked={outcome === "refused"} onChange={() => setOutcome("refused")} className={RADIO_DOT} />
            <span className="text-lg font-bold">No, they refused my card</span>
          </span>
        </label>
      </fieldset>

      <p className="mt-5 flex gap-3 text-ink/80">
        <Icon name="lock" className="mt-0.5 h-5 w-5" />
        Anonymous. We never ask for your name or card number. Hospitals see totals, not people.
      </p>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`mt-4 rounded-xl p-4 ${notice.tone === "error" ? "bg-emergency-bg text-emergency" : "bg-brand/10 text-brand"}`}
        >
          <p className="font-semibold">{notice.text}</p>
          {notice.tone === "info" && (
            <Link href={`/facility/${facilityId}?card=${card.slug}`} className="mt-2 inline-flex min-h-11 items-center font-bold underline">
              Back to the hospital
            </Link>
          )}
        </div>
      )}

      <div className="mt-auto pt-8">
        <button
          type="submit"
          disabled={!outcome || busy}
          className="min-h-14 w-full rounded-2xl bg-brand text-lg font-bold text-white disabled:bg-ink/30"
        >
          {busy ? "Sending…" : "Send"}
        </button>
        {!outcome && <p className="mt-2 text-center text-sm text-ink/70">Choose an answer to send.</p>}
      </div>
    </form>
  );
}
