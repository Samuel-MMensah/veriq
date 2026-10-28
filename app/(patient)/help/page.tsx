import type { Metadata } from "next";
import { ROOT_MENU } from "@/lib/ussd/menu";

export const metadata: Metadata = { title: "Help: USSD and SMS" };

// Screen 13, Phase 1: explains the USSD menu and SMS reply. The menu itself is /api/ussd (tested);
// it goes live through an aggregator in Phase 2, so the code is a placeholder.
const SCREENS = [
  { title: "Dial *[code]#", body: ROOT_MENU },
  { title: "You chose 1", body: "Your card?\n1 NHIS\n2 Private\n3 No card\nNeed?\n1 Antenatal / maternity\n2 See a doctor" },
];

const SMS = `VERIQ (sample data): Antenatal / maternity, NHIS, near Dansoman
1) AKOMA MISSION HOSPITAL, Kaneshie 1.8km. NHIS: Confirmed by hospital 2 days ago. Antenatal clinic: Open till 4 pm. Scan top-up about GHS 80 (3 patients, last 60 days).
2) LAKESIDE FAMILY CLINIC, Dansoman 2.6km. NHIS: 14 patients confirmed in the last 30 days.
Dial again and choose 3 to report a refusal.`;

export default function HelpPage() {
  return (
    // Help is a bottom-bar tab, so it has no back arrow.
    <main className="flex min-h-full flex-col px-4 pb-6 pt-6">
      <p className="text-small font-semibold text-muted">Help</p>
      <h1 className="mt-1 text-title">No smartphone? No data? Dial Veriq.</h1>
      <p className="mt-2 text-muted">Any phone, any network. The answer comes by SMS.</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {SCREENS.map((s) => (
          <figure key={s.title} className="rounded-(--radius-card) bg-ink p-4 font-mono text-small text-white">
            <figcaption className="font-semibold text-white/80">{s.title}</figcaption>
            <pre className="mt-2 whitespace-pre-wrap font-mono">{s.body}</pre>
          </figure>
        ))}
      </div>

      <h2 className="mt-6 text-section">Then an SMS</h2>
      <pre className="mt-2 whitespace-pre-wrap rounded-(--radius-card) bg-surface p-4 font-sans text-small text-ink shadow-card">
        {SMS}
      </pre>

      {/* SPEC screen 13: the code is a placeholder until the aggregator gives one (Prompt 15). */}
      <p className="mt-3 text-small text-muted">The short code comes with the pilot.</p>

      <a
        href="tel:112"
        className="mt-6 flex min-h-12 w-full items-center justify-center rounded-(--radius-control) bg-emergency font-semibold text-white"
      >
        Emergency? Call 112
      </a>
    </main>
  );
}
