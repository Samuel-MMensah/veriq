import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AreaSwitch } from "@/components/emergency/AreaSwitch";
import { CardNote } from "@/components/emergency/CardNotes";
import { Icon } from "@/components/ui/Icon";
import { SampleDataTag } from "@/components/ui/SampleDataTag";
import { getEmergencyCandidates, getEmergencyNotChecked, listInsurers } from "@/lib/db/queries";
import { readDb } from "@/lib/db/server";
import { isDemoMode } from "@/lib/demo/mode";
import type { LatLng } from "@/lib/geo";
import { showSampleTag } from "@/lib/rules/directory";
import { EMERGENCY_RADIUS_KM } from "@/lib/rules/sort";
import { AREAS, DEFAULT_AREA, type SearchParams } from "@/lib/view/catalog";
import { buildEmergency, buildNotChecked, type EmergencyUnit, type NotCheckedUnit } from "@/lib/view/emergency";

export const metadata: Metadata = { title: "Emergency mode" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Screen 6. Rule 3: the card never hides a hospital. The list is built by rule S2 with no card input.
// The 112 and 193 buttons need no data, so they are sent at once; the list streams in after
// (Suspense), so a slow 3G connection never delays the call buttons.
export default async function EmergencyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const lat = Number(first(sp.lat));
  const lng = Number(first(sp.lng));
  const hasPoint = Boolean(first(sp.lat) && first(sp.lng)) && Number.isFinite(lat) && Number.isFinite(lng);
  const area = AREAS.find((a) => a.slug === first(sp.area));
  const origin = hasPoint ? { lat, lng } : DEFAULT_AREA;
  const placeName = hasPoint ? (area?.name ?? (first(sp.near) === "me" ? "you" : "this place")) : DEFAULT_AREA.name;
  const demoMode = await isDemoMode(sp);

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
          <a href="tel:112" className="flex items-center gap-3 rounded-2xl bg-white p-4 text-emergency">
            <Icon name="phone" className="h-7 w-7" />
            <span>
              <span className="block text-4xl font-extrabold leading-none">112</span>
              <span className="mt-1 block font-semibold">Emergency line</span>
            </span>
          </a>
          <a href="tel:193" className="flex items-center gap-3 rounded-2xl bg-white p-4 text-emergency">
            <Icon name="phone" className="h-7 w-7" />
            <span>
              <span className="block text-4xl font-extrabold leading-none">193</span>
              <span className="mt-1 block font-semibold">Ambulance</span>
            </span>
          </a>
        </div>
      </header>

      <main className="px-4 pb-8 pt-5">
        <h2 className="text-xl font-bold">Emergency units near {placeName}</h2>
        <AreaSwitch hasPoint={hasPoint} />

        <Suspense fallback={<UnitsLoading />}>
          <Units origin={origin} demoMode={demoMode} />
        </Suspense>

        <p className="mt-4 flex gap-3 rounded-2xl bg-page p-4 text-ink/80">
          <Icon name="info" className="mt-0.5 h-5 w-5" />
          Sorted by status and distance. Your card never hides a hospital. Ambulance crews choose the hospital through the
          national bed system.
        </p>
      </main>
    </div>
  );
}

function UnitsLoading() {
  return (
    <p role="status" className="mt-3 rounded-2xl bg-page p-4 text-ink/80">
      Finding emergency units near you… You can call 112 or 193 now.
    </p>
  );
}

async function Units({ origin, demoMode }: { origin: LatLng; demoMode: boolean }) {
  const db = await readDb();
  const now = new Date();
  const input = { ...origin, now, demoMode };
  const [candidates, notCheckedCandidates, insurers] = await Promise.all([
    getEmergencyCandidates(db, input),
    getEmergencyNotChecked(db, input),
    listInsurers(db),
  ]);
  const units = buildEmergency({ candidates, insurers, origin, now });
  // Rule S2 addition: real hospitals with no emergency status come after every unit with one.
  const notChecked = buildNotChecked({ candidates: notCheckedCandidates, insurers, origin, now });
  const names = Object.fromEntries(insurers.map((i) => [i.slug, i.name]));

  if (units.length === 0 && notChecked.length === 0) {
    return (
      <p className="mt-4 rounded-2xl bg-page p-4 text-ink/80">
        We know of no emergency unit within {EMERGENCY_RADIUS_KM} km. Call 112 or 193 now.
      </p>
    );
  }
  return (
    <>
      {/* Rule 1: the tag shows only while a demo hospital is listed. */}
      {showSampleTag(candidates.map((c) => c.facility)) && <SampleDataTag className="mt-2" />}
      <ul className="mt-3 space-y-3">
        {units.map((u) => (
          <UnitWithStatus key={u.id} unit={u} names={names} />
        ))}
        {notChecked.map((u) => (
          <UnitNotChecked key={u.id} unit={u} names={names} />
        ))}
      </ul>
    </>
  );
}

function UnitWithStatus({ unit: u, names }: { unit: EmergencyUnit; names: Record<string, string> }) {
  const full = u.status.tone === "bad";
  const greyed = u.status.freshness.greyed || u.status.freshness.state === "none";
  return (
    <li className={`rounded-2xl border p-4 ${full ? "border-ink/10 bg-page" : "border-ink/15 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className={`text-lg font-bold leading-snug ${full ? "text-ink/70" : ""}`}>{u.name}</h3>
        <span className="shrink-0 text-sm font-semibold text-ink/80">{u.distanceKm} km</span>
      </div>
      <p className={`mt-1 font-bold ${full ? "text-refused-ink" : greyed ? "text-ink/70" : "text-brand"}`}>
        {full ? `Says ${u.status.word.toLowerCase()}` : u.status.word}
        {u.status.sourceText && <span className="font-semibold"> · {u.status.sourceText.replace("updated by hospital ", "updated ")}</span>}
        {(u.status.freshness.state === "aging" || u.status.freshness.state === "stale") && (
          <span className="font-semibold"> · {u.status.freshness.warning}</span>
        )}
      </p>
      {(full || greyed) && <p className="text-sm text-ink/80">Call before going</p>}
      {u.sourceLine && <p className="text-sm text-ink/70">{u.sourceLine}</p>}
      <CardNote cardBadges={u.cardBadges} names={names} />
      <CallAndGo unit={u} />
    </li>
  );
}

/** Rule S2 addition: "Emergency not checked. Call first", with its NHIA source (rule D1). */
function UnitNotChecked({ unit: u, names }: { unit: NotCheckedUnit; names: Record<string, string> }) {
  return (
    <li className="rounded-2xl border border-ink/15 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold leading-snug">{u.name}</h3>
        <span className="shrink-0 text-sm font-semibold text-ink/80">{u.distanceKm} km</span>
      </div>
      <p className="mt-1 font-bold text-ink/80">Emergency not checked. Call first</p>
      {u.nhiaType && <p className="text-sm text-ink/80">Type on the NHIA list: {u.nhiaType}</p>}
      {u.sourceLine && <p className="text-sm text-ink/70">{u.sourceLine}</p>}
      <CardNote cardBadges={u.cardBadges} names={names} />
      <CallAndGo unit={u} />
    </li>
  );
}

function CallAndGo({ unit: u }: { unit: { name: string; phone: string | null; directionsUrl: string } }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {u.phone ? (
        <a
          href={`tel:${u.phone.replace(/\s/g, "")}`}
          aria-label={`Call ${u.name}`}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-emergency font-bold text-emergency"
        >
          <Icon name="phone" className="h-5 w-5" /> Call
        </a>
      ) : (
        <span className="inline-flex min-h-12 items-center justify-center text-sm text-ink/70">No phone number</span>
      )}
      <a
        href={u.directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Go: directions to ${u.name}`}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emergency font-bold text-white"
      >
        <Icon name="map" className="h-5 w-5" /> Go
      </a>
    </div>
  );
}
