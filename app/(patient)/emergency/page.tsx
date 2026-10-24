import type { Metadata } from "next";
import Link from "next/link";
import { AreaSwitch } from "@/components/emergency/AreaSwitch";
import { CardNote } from "@/components/emergency/CardNotes";
import { Icon } from "@/components/ui/Icon";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { getEmergencyCandidates, listInsurers } from "@/lib/db/queries";
import { readDb } from "@/lib/db/server";
import { EMERGENCY_RADIUS_KM } from "@/lib/rules/sort";
import { AREAS, DEFAULT_AREA, type SearchParams } from "@/lib/view/catalog";
import { buildEmergency } from "@/lib/view/emergency";

export const metadata: Metadata = { title: "Emergency mode" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Screen 6. Rule 3: the card never hides a hospital. The list is built by rule S2 with no card input.
export default async function EmergencyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const lat = Number(first(sp.lat));
  const lng = Number(first(sp.lng));
  const hasPoint = Boolean(first(sp.lat) && first(sp.lng)) && Number.isFinite(lat) && Number.isFinite(lng);
  const area = AREAS.find((a) => a.slug === first(sp.area));
  const origin = hasPoint ? { lat, lng } : DEFAULT_AREA;
  const placeName = hasPoint ? (area?.name ?? (first(sp.near) === "me" ? "you" : "this place")) : DEFAULT_AREA.name;

  const db = await readDb();
  const now = new Date();
  const [candidates, insurers] = await Promise.all([getEmergencyCandidates(db, { ...origin, now }), listInsurers(db)]);
  const units = buildEmergency({ candidates, insurers, origin, now });
  const names = Object.fromEntries(insurers.map((i) => [i.slug, i.name]));

  return (
    <div className="min-h-dvh bg-white">
      <header className="bg-emergency px-4 pb-6 pt-4 text-white">
        <div className="flex items-center gap-2">
          <Link href="/find" aria-label="Close emergency mode" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
            <Icon name="close" className="h-6 w-6" />
          </Link>
          <p className="text-lg font-semibold">Emergency mode</p>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight">Get help now. Cards come later.</h1>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <a href="tel:112" className="rounded-2xl bg-white p-4 text-emergency">
            <span className="block text-4xl font-extrabold">112</span>
            <span className="block font-semibold">Emergency line</span>
          </a>
          <a href="tel:193" className="rounded-2xl bg-white p-4 text-emergency">
            <span className="block text-4xl font-extrabold">193</span>
            <span className="block font-semibold">Ambulance</span>
          </a>
        </div>
      </header>

      <main className="px-4 pb-8 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Emergency units near {placeName}</h2>
            <AreaSwitch hasPoint={hasPoint} />
          </div>
          <SampleDataTag className="shrink-0" />
        </div>

        {units.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-page p-4 text-ink/80">
            We know of no emergency unit within {EMERGENCY_RADIUS_KM} km. Call 112 or 193 now.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {units.map((u) => {
              const full = u.status.tone === "bad";
              const greyed = u.status.freshness.greyed || u.status.freshness.state === "none";
              return (
                <li key={u.id} className={`rounded-2xl border p-4 ${full ? "border-ink/10 bg-page" : "border-ink/15 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className={`text-lg font-bold leading-snug ${full ? "text-ink/70" : ""}`}>{u.name}</h3>
                    <span className="shrink-0 text-sm text-ink/70">{u.distanceKm} km</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className={`font-bold ${full ? "text-refused-ink" : greyed ? "text-ink/70" : "text-brand"}`}>
                      {full ? `Says ${u.status.word.toLowerCase()}` : u.status.word}
                      {u.status.sourceText && <span className="font-semibold"> · {u.status.sourceText.replace("updated by hospital ", "updated ")}</span>}
                      {u.status.freshness.state !== "fresh" && u.status.freshness.state !== "none" && (
                        <span className="font-semibold"> · {u.status.freshness.warning}</span>
                      )}
                    </p>
                    <a
                      href={u.directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center font-bold text-emergency underline"
                      aria-label={`Go: directions to ${u.name}`}
                    >
                      Go
                    </a>
                  </div>
                  {(full || greyed) && <p className="text-sm text-ink/70">Call before going</p>}
                  <CardNote cardBadges={u.cardBadges} names={names} />
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 flex gap-3 rounded-2xl bg-page p-4 text-ink/80">
          <Icon name="info" className="mt-0.5 h-5 w-5" />
          Sorted by status and distance only. Your card is shown, but never hides a hospital. If an ambulance is coming, the
          crew picks the hospital through the national bed system.
        </p>
      </main>
    </div>
  );
}
