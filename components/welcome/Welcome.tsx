"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { setSeenCookie } from "@/lib/local/prefs";

/** Screen 7 shows once; after that "/" goes straight to Find care. */
export const SEEN_WELCOME_KEY = "veriq.seenWelcome";

// Prompt 10c: three short points, no paragraphs.
const POINTS: { icon: IconName; title: string }[] = [
  { icon: "card", title: "Check your card first" },
  { icon: "clock", title: "See what's open today" },
  { icon: "people", title: "Help the next person" },
];

// Phase 2 (Prompt 17) adds Twi, Ga, Ewe, Dagbani and Hausa; SPEC screen 7 marks them as coming soon.

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_WELCOME_KEY, "1");
    setSeenCookie();
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
    <main className="flex min-h-dvh flex-col bg-surface px-4 pb-6 pt-10">
      <div className="flex items-center justify-between gap-3">
        <p aria-hidden="true" className="text-title text-brand">
          veriq <span className="font-semibold text-muted">health</span>
        </p>
        {/* Someone may open Veriq for the first time in an emergency: one tap, no welcome to read. */}
        <Link href="/emergency" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-emergency">
          <Icon name="alert" className="h-5 w-5" />
          Emergency
        </Link>
      </div>

      <h1 className="mt-12 animate-enter text-title">Know before you go.</h1>
      <p className="mt-2 text-muted">Which hospitals really take your card, before you travel.</p>

      <ul className="mt-8 space-y-4">
        {POINTS.map((p, i) => (
          <li key={p.title} className="flex animate-enter items-center gap-3" style={{ animationDelay: `${80 + i * 60}ms` }}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon name={p.icon} className="h-5 w-5" />
            </span>
            <span className="font-semibold">{p.title}</span>
          </li>
        ))}
      </ul>

      <fieldset className="mt-8">
        <legend className="text-small font-semibold text-muted">Language</legend>
        <div className="mt-2 flex items-center gap-3">
          <span className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-brand bg-brand-soft px-4 font-semibold text-brand-strong" aria-current="true">
            English
          </span>
          <span className="text-small text-muted">More languages soon</span>
        </div>
      </fieldset>

      <div className="mt-auto space-y-1 pt-10">
        <Link
          href="/find"
          onClick={markSeen}
          className="flex min-h-12 w-full items-center justify-center rounded-(--radius-control) bg-brand font-semibold text-white transition-colors hover:bg-brand-strong"
        >
          Get started
        </Link>
        <p className="text-center">
          <Link href="/how-we-check" onClick={markSeen} className="inline-flex min-h-11 items-center text-small font-semibold text-brand">
            How we check
          </Link>
        </p>
      </div>
    </main>
  );
}
