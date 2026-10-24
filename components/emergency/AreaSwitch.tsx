"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const LAST_AREA_KEY = "veriq.lastArea";

/**
 * Emergency mode starts from the last search area on this phone (rule 8) when the link has none,
 * and can switch to the phone's location.
 */
export function AreaSwitch({ hasPoint }: { hasPoint: boolean }) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasPoint) return;
    try {
      const raw = window.localStorage.getItem(LAST_AREA_KEY);
      const last = raw ? (JSON.parse(raw) as { lat: number; lng: number; name: string; slug: string | null }) : null;
      if (last && Number.isFinite(last.lat) && Number.isFinite(last.lng)) {
        router.replace(`/emergency?lat=${last.lat}&lng=${last.lng}${last.slug ? `&area=${last.slug}` : "&near=me"}`);
      }
    } catch {
      // No saved area: stay on the default.
    }
  }, [hasPoint, router]);

  function locate() {
    if (!("geolocation" in navigator)) {
      setError("This phone can't share its location.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => router.replace(`/emergency?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&near=me`),
      () => {
        setLocating(false);
        setError("Couldn't get your location.");
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  }

  return (
    <div className="mt-1">
      <button type="button" onClick={locate} disabled={locating} className="min-h-11 font-semibold text-emergency underline disabled:opacity-60">
        {locating ? "Finding you…" : "Use my location"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-emergency">
          {error}
        </p>
      )}
    </div>
  );
}
