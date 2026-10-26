"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { describedBy, inputClass } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import type { ActionState } from "@/lib/admin/form";
import { parseLocation, tileFor } from "@/lib/admin/location";

const ZOOM = 16;

/**
 * Type or paste "lat, lng"; the point shows on an OpenStreetMap preview before you save, so a
 * swapped number or a missing minus is caught by eye (rule D1, location_source = admin).
 */
export function LocationForm({
  facilityId,
  name,
  query,
  action,
}: {
  facilityId: string;
  name: string;
  /** The search, kept after saving. */
  query: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const [text, setText] = useState("");
  const [state, formAction, pending] = useActionState(action, null);
  const parsed = text.trim() ? parseLocation(text) : null;
  const id = `loc-${facilityId}`;
  const error = state?.error ?? (parsed && !parsed.ok ? parsed.message : null);

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="facility" value={facilityId} />
      <input type="hidden" name="q" value={query} />
      <label className="sr-only" htmlFor={id}>
        Latitude and longitude for {name}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name="location"
          inputMode="decimal"
          autoComplete="off"
          placeholder="5.5612, -0.2601"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, null, error)}
          className={`${inputClass(Boolean(error))} min-w-0 flex-1`}
        />
        <Button disabled={!parsed?.ok || pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
      {parsed?.ok && <MapPreview lat={parsed.lat} lng={parsed.lng} name={name} />}
    </form>
  );
}

/** Nine OpenStreetMap tiles around the point, with a pin at the centre. No map library needed. */
function MapPreview({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const t = tileFor(lat, lng, ZOOM);
  const tiles = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ dx, dy })));
  return (
    <figure className="animate-fade overflow-hidden rounded-(--radius-control) border border-line">
      <div className="relative h-48 overflow-hidden bg-neutral-bg" role="img" aria-label={`Map preview of the point for ${name}`}>
        <div className="absolute grid grid-cols-3" style={{ width: 768, left: `calc(50% - ${256 + t.px}px)`, top: `calc(50% - ${256 + t.py}px)` }}>
          {tiles.map(({ dx, dy }) => (
            // eslint-disable-next-line @next/next/no-img-element -- plain map tiles, no optimisation wanted
            <img key={`${dx}${dy}`} src={`https://tile.openstreetmap.org/${ZOOM}/${t.x + dx}/${t.y + dy}.png`} alt="" width={256} height={256} loading="lazy" />
          ))}
        </div>
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full text-danger-ink drop-shadow">
          <Icon name="pin" className="h-9 w-9 fill-white" />
        </span>
      </div>
      <figcaption className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm text-muted">
        <span>
          {lat}, {lng}
        </span>
        <span>
          ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
            OpenStreetMap contributors
          </a>
        </span>
      </figcaption>
    </figure>
  );
}
