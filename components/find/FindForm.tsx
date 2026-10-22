"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
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
  "inline-flex min-h-12 cursor-pointer items-center rounded-full border border-ink/20 bg-white px-5 text-base font-medium has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:font-bold has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";
const cardBox =
  "flex min-h-16 cursor-pointer flex-col justify-center rounded-xl border border-ink/20 bg-white px-4 py-2 has-[:checked]:border-2 has-[:checked]:border-brand has-[:checked]:bg-brand/10 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand";

export function FindForm() {
  const [card, setCard] = useState("nhis");
  const [place, setPlace] = useState<Place>(fromArea(DEFAULT_AREA));
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM);
  const [changing, setChanging] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useEffect(() => {
    // Reading localStorage must wait until after hydration.
    const last = loadLastArea();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (last) setPlace(last);
  }, []);

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
    <form action="/results" method="get" onSubmit={() => saveLastArea(place)} className="space-y-6">
      <fieldset>
        <legend className="text-xl font-bold">What do you need?</legend>
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
        <legend className="text-xl font-bold">Which card will you use?</legend>
        {/* Saved cards come first once Prompt 6 adds them (screen 5). */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          {CARD_OPTIONS.map((c) => (
            <label key={c.slug} className={cardBox}>
              <input
                type="radio"
                name="card"
                value={c.slug}
                checked={card === c.slug}
                onChange={() => setCard(c.slug)}
                className="sr-only"
              />
              <span className="font-bold leading-tight">{c.name}</span>
              <span className="text-sm text-ink/70">{c.note}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-xl border border-ink/15 bg-white p-4">
        <div className="flex items-center gap-3">
          <Icon name="pin" className="h-6 w-6 text-brand" />
          <div className="flex-1">
            <p className="font-semibold">{place.name === "you" ? "Near you" : `Near ${place.name}, Accra`}</p>
            <p className="text-sm text-ink/70">Within {radius} km</p>
          </div>
          <button
            type="button"
            aria-expanded={changing}
            aria-controls="area-panel"
            onClick={() => setChanging((v) => !v)}
            className="min-h-11 px-2 font-bold text-brand"
          >
            {changing ? "Done" : "Change"}
          </button>
        </div>
        {changing && (
          <div id="area-panel" className="mt-4 space-y-3 border-t border-ink/10 pt-4">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand font-bold text-brand disabled:opacity-60"
            >
              <Icon name="locate" className="h-5 w-5" />
              {locating ? "Finding you…" : "Use my location"}
            </button>
            {locateError && (
              <p role="alert" className="text-sm text-emergency">
                {locateError}
              </p>
            )}
            <label className="block text-sm font-semibold">
              Or pick an area
              <select
                value={place.slug ?? ""}
                onChange={(e) => {
                  const a = AREAS.find((x) => x.slug === e.target.value);
                  if (a) setPlace(fromArea(a));
                }}
                className="mt-1 block min-h-11 w-full rounded-lg border border-ink/20 bg-white px-3 text-base font-normal"
              >
                {place.slug === null && <option value="">Your location</option>}
                {AREAS.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              How far
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="mt-1 block min-h-11 w-full rounded-lg border border-ink/20 bg-white px-3 text-base font-normal"
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

      <button type="submit" className="min-h-14 w-full rounded-2xl bg-brand px-4 text-lg font-bold text-white">
        {buttonText}
      </button>
    </form>
  );
}
