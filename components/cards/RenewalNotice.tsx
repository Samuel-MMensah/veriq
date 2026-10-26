import { Icon } from "@/components/ui/Icon";
import type { RenewalReminder } from "@/lib/local/cards";

/** The NHIS renewal reminder, a month before expiry (screen 5). */
export function RenewalNotice({ reminder, hasNhisWithoutExpiry }: { reminder: RenewalReminder | null; hasNhisWithoutExpiry: boolean }) {
  let text: string | null = null;
  if (reminder?.state === "expired") {
    text = `Your NHIS card expired at the end of ${reminder.monthLabel}. Renew by dialling *929#. Until you do, NHIS hospitals may ask you to pay.`;
  } else if (reminder?.state === "due") {
    text = `Your NHIS card expires at the end of ${reminder.monthLabel}. Renew now by dialling *929#.`;
  } else if (reminder?.state === "later") {
    text = `We'll remind you a month before your NHIS card expires (${reminder.monthLabel}). Renew by dialling *929#.`;
  } else if (hasNhisWithoutExpiry) {
    text = "Add your NHIS card's expiry month and we'll remind you a month before. Renew by dialling *929#.";
  }
  if (!text) return null;
  const urgent = reminder?.state === "due" || reminder?.state === "expired";
  return (
    <p
      role={urgent ? "alert" : undefined}
      className={`flex gap-3 rounded-(--radius-card) p-4 text-refused-ink ${urgent ? "border-2 border-refused bg-refused-bg font-semibold" : "bg-refused-bg"}`}
    >
      <Icon name="bell" className="mt-0.5 h-5 w-5" />
      {text}
    </p>
  );
}
