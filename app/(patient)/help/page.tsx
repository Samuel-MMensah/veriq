import type { Metadata } from "next";
import { BackLink } from "@/components/ui/BackLink";
import { Icon } from "@/components/ui/Icon";
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
    <main className="flex min-h-full flex-col px-4 pb-6 pt-4">
      <div className="flex items-center gap-2">
        <BackLink fallback="/find" />
        <p className="text-lg text-ink/70">Help</p>
      </div>
      <h1 className="mt-4 text-3xl font-extrabold leading-tight">No smartphone? No data? Dial Veriq.</h1>
      <p className="mt-2 text-lg text-ink/80">
        Works on any phone, any network. The answer comes back by SMS so you can keep it.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {SCREENS.map((s) => (
          <figure key={s.title} className="rounded-2xl bg-ink p-4 font-mono text-sm leading-relaxed text-white">
            <figcaption className="font-bold text-patient">{s.title}</figcaption>
            <pre className="mt-2 whitespace-pre-wrap font-mono">{s.body}</pre>
          </figure>
        ))}
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink/70">Then an SMS like this</h2>
      <pre className="mt-2 whitespace-pre-wrap rounded-2xl border border-ink/15 bg-page p-4 font-sans text-base text-ink">
        {SMS}
      </pre>

      <p className="mt-4 flex gap-3 rounded-2xl bg-refused-bg p-4 text-refused-ink">
        <Icon name="info" className="mt-0.5 h-5 w-5" />
        Code not yet registered. A short code comes through a USSD aggregator after the pilot.
      </p>

      <a
        href="tel:112"
        className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-emergency text-lg font-bold text-white"
      >
        Emergency? Call 112
      </a>
    </main>
  );
}
