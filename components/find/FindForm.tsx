"use client";

import { useEffect, useState } from "react";
import { RenewalNotice } from "@/components/cards/RenewalNotice";
import { Icon } from "@/components/ui/Icon";
import { listCards, renewalReminder, type SavedCard } from "@/lib/local/cards";
import { setLastCard, setLastSearch } from "@/lib/local/prefs";
import {
  AREAS,
  CARD_OPTIONS,
  CASH,
  DEFAULT_AREA,
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS_KM,
  SERVICE_CHIPS,
} from "@/lib/view/catalog";

type Place = { lat: number; lng: number; name: string; slug: string | null };

const LAST_AREA_KEY = "veriq.lastArea";
const fromArea = (a: (typeof AREAS)[number]): Place => ({ lat: a.lat, lng: a.lng, name: a.name, slug: a.slug });

/** Rule 8: remember the last search area on this phone. */
function loadLastArea(): Place | null {
  try {
    const raw = window.localStorage.getItem(LAST_AREA_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Place;
    return Number.isFinite(p.lat) && Number.isFinite(p.lng) && typeof p.name === "string" ? p : null;
  } catch {
    return null;
  }
}

function saveLastArea(place: Place) {
  try {
    window.localStorage.setItem(LAST_AREA_KEY, JSON.stringify(place));
  } catch {
    // Private mode or full storage: searching still works.
  }
}

const chip =
  "inline-flex min-h-12 cursor-pointer items-center rounded-full border border-line-strong bg-surface px-5 text-body font-semibold transition-colors hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:font-bold has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";
const cardBox =
  "flex min-h-12 cursor-pointer flex-col justify-center rounded-(--radius-control) border border-line-strong bg-surface px-4 py-2 transition-colors hover:border-brand has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:ring-1 has-[:checked]:ring-brand has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";

export function FindForm() {
  const [card, setCard] = useState("nhis");
  const [place, setPlace] = useState<Place>(fromArea(DEFAULT_AREA));
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM);
  const [changing, setChanging] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [saved, setSaved] = useState<SavedCard[]>([]);
  const [cardTouched, setCardTouched] = useState(false);

  useEffect(() => {
    // Reading localStorage must wait until after hydration.
    const last = loadLastArea();
    if (last) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlace(last);
    }
    // Coming back to this page (browser back) must not leave the button saying "Finding…".
    const reset = () => setSubmitting(false);
    window.addEventListener("pageshow", reset);
    // Saved cards come first, and the default card is chosen (screen 1). They stay on the phone:
    // only the card type (e.g. "nhis") goes in the search link.
    listCards()
      .then(setSaved)
      .catch(() => setSaved([]));
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  useEffect(() => {
    const preferred = saved[0]?.insurerSlug;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preferred && !cardTouched) setCard(preferred);
  }, [saved, cardTouched]);

  const savedSlugs = [...new Set(saved.map((c) => c.insurerSlug))];
  const cardOptions = [
    ...savedSlugs.flatMap((slug) => {
      const option = CARD_OPTIONS.find((c) => c.slug === slug);
      const holder = saved.find((c) => c.insurerSlug === slug);
      return option ? [{ ...option, note: `Saved card${holder ? ` · ${holder.nickname}` : ""}` as string | null }] : [];
    }),
    // Prompt 10c: no "Public/Private" notes; only a saved card says so.
    ...CARD_OPTIONS.filter((c) => !savedSlugs.includes(c.slug)).map((c) => ({ ...c, note: null as string | null })),
  ];
  const reminder = renewalReminder(saved, new Date());

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError("This phone can't share its location. Pick an area instead.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: "you", slug: null });
        setLocating(false);
        setChanging(false);
      },
      () => {
        setLocateError("Couldn't get your location. Pick an area instead.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  }

  const cardLabel = CARD_OPTIONS.find((c) => c.slug === card)?.name ?? "your card";
  const buttonText = card === CASH ? "Show hospitals near you" : `Show hospitals that take ${cardLabel}`;

  return (
    <form
      action="/results"
      method="get"
      onSubmit={(e) => {
        saveLastArea(place);
        setLastCard(card);
        setLastSearch(new URLSearchParams(new FormData(e.currentTarget) as unknown as Record<string, string>));
        // On 3G the next page can take a few seconds: say so, so nobody taps twice.
        setSubmitting(true);
      }}
      className="space-y-6"
    >
      {(reminder?.state === "due" || reminder?.state === "expired") && (
        <RenewalNotice reminder={reminder} hasNhisWithoutExpiry={false} />
      )}
      <fieldset>
        <legend className="text-section">What do you need?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {SERVICE_CHIPS.map((s, i) => (
            <label key={s.slug} className={chip}>
              <input type="radio" name="service" value={s.slug} defaultChecked={i === 0} className="sr-only" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-section">Your card</legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {cardOptions.map((c) => (
            <label key={c.slug} className={cardBox}>
              <input
                type="radio"
                name="card"
                value={c.slug}
                checked={card === c.slug}
                onChange={() => {
                  setCard(c.slug);
                  setCardTouched(true);
                }}
                className="sr-only"
              />
              <span className="font-semibold leading-tight">{c.name}</span>
              {c.note && <span className="text-small text-muted">{c.note}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-(--radius-card) border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <Icon name="pin" className="h-6 w-6 text-brand" />
          <div className="flex-1">
            <p className="font-semibold">{place.name === "you" ? "Near you" : `Near ${place.name}, Accra`}</p>
            <p className="text-small text-muted">Within {radius} km</p>
          </div>
          <button
            type="button"
            aria-expanded={changing}
            aria-controls="area-panel"
            onClick={() => setChanging((v) => !v)}
            className="min-h-11 px-2 font-semibold text-brand"
          >
            {changing ? "Done" : "Change"}
          </button>
        </div>
        {changing && (
          <div id="area-panel" className="mt-4 space-y-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-(--radius-control) border border-line-strong font-semibold text-ink hover:border-brand hover:text-brand disabled:opacity-60"
            >
              <Icon name="locate" className="h-5 w-5" />
              {locating ? "Finding you…" : "Use my location"}
            </button>
            {locateError && (
              <p role="alert" className="text-small font-semibold text-warn-ink">
                {locateError}
              </p>
            )}
            <label className="block text-small font-semibold">
              Or pick an area
              <select
                value={place.slug ?? ""}
                onChange={(e) => {
                  const a = AREAS.find((x) => x.slug === e.target.value);
                  if (a) {
                    setPlace(fromArea(a));
                  }
                }}
                className="mt-1 block min-h-12 w-full rounded-(--radius-control) border border-line-strong bg-surface px-3 text-body font-normal"
              >
                {place.slug === null && <option value="">Your location</option>}
                {AREAS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-small font-semibold">
              How far
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="mt-1 block min-h-12 w-full rounded-(--radius-control) border border-line-strong bg-surface px-3 text-body font-normal"
              >
                {RADIUS_OPTIONS_KM.map((r) => (
                  <option key={r} value={r}>
                    Within {r} km
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <input type="hidden" name="lat" value={place.lat} />
      <input type="hidden" name="lng" value={place.lng} />
      <input type="hidden" name="r" value={radius} />
      {place.slug ? <input type="hidden" name="area" value={place.slug} /> : <input type="hidden" name="near" value="me" />}

      {/* Always in reach above the bottom bar, even on a small phone (rule 7). */}
      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] -mx-4 border-t border-line bg-surface/95 px-4 pt-3 pb-3 backdrop-blur">
        <button
          type="submit"
          aria-busy={submitting}
          className="min-h-12 w-full rounded-(--radius-control) bg-brand px-4 font-semibold text-white transition-colors hover:bg-brand-strong aria-busy:opacity-80"
        >
          {submitting ? "Finding hospitals…" : buttonText}
        </button>
      </div>
    </form>
  );
}
