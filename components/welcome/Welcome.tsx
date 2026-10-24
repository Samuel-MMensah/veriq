"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

/** Screen 7 shows once; after that "/" goes straight to Find care. */
export const SEEN_WELCOME_KEY = "veriq.seenWelcome";

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: "card", title: "Check your card first", text: "NHIS or private, confirmed by hospitals and patients." },
  { icon: "clock", title: "See what's open today", text: "Clinics, scans and specialists, with the time it was updated." },
  { icon: "people", title: "Help the next person", text: "One tap after your visit keeps Veriq true." },
];

const LANGUAGES = ["Twi", "Ga", "Ewe", "Dagbani", "Hausa"];

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_WELCOME_KEY, "1");
  } catch {
    // Private mode: the welcome shows again next time, which is harmless.
  }
}

export function Welcome() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SEEN_WELCOME_KEY)) router.replace("/find");
    } catch {
      // Storage blocked: show the welcome.
    }
  }, [router]);

  return (
    <main className="flex min-h-dvh flex-col bg-brand px-6 pb-6 pt-12 text-white">
      <p aria-hidden="true" className="text-6xl font-extrabold leading-none tracking-tight">
        veriq
      </p>
      <p aria-hidden="true" className="mt-2 text-lg font-semibold tracking-[0.3em] text-white/85">
        HEALTH
      </p>
      <h1 className="mt-4 text-3xl font-extrabold">Know before you go.</h1>
      <p className="mt-3 text-lg text-white/85">
        See which hospitals really take your card, what&apos;s open today, and what other patients paid.
      </p>

      <ul className="mt-8 space-y-5">
        {POINTS.map((p) => (
          <li key={p.title} className="flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Icon name={p.icon} className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-lg font-bold">{p.title}</span>
              <span className="block text-white/85">{p.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <fieldset className="mt-8">
        <legend className="font-bold">Language</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex min-h-11 items-center rounded-full bg-white px-5 font-bold text-brand" aria-current="true">
            English
          </span>
          {LANGUAGES.map((l) => (
            <span
              key={l}
              aria-disabled="true"
              className="inline-flex min-h-11 items-center rounded-full border border-white/40 px-5 text-white/80"
            >
              {l} <span className="ml-1 text-xs">(coming soon)</span>
            </span>
          ))}
        </div>
      </fieldset>

      <div className="mt-auto pt-10">
        <Link
          href="/find"
          onClick={markSeen}
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-white text-lg font-bold text-brand"
        >
          Get started
        </Link>
        <p className="mt-4 text-center text-sm text-white/85">
          No sign-up needed. Every answer shows who confirmed it and when.{" "}
          <Link href="/how-we-check" onClick={markSeen} className="font-bold text-white underline">
            How we check
          </Link>
        </p>
      </div>
    </main>
  );
}
