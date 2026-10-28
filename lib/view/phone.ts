// A tel: link only for a number that can really be called. Demo facilities carry the placeholder
// "+233 000 000 nnn" (reset_demo); Ghana numbers never start with 000 after the country code.
const PLACEHOLDER = /^(\+?233|0)0{2,}/;

const CALL_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" });

/**
 * Rule 4 beside a Call button: where the number came from. "Veriq call, 28 Oct 2026" for a number a
 * Veriq verification call reached (Prompt 10b), "NHIA list" for the file's own; null otherwise (demo).
 */
export function phoneSourceText(f: { phone: string | null; phone_source: string | null; phone_checked_at: string | null }): string | null {
  if (!f.phone) return null;
  if (f.phone_source === "veriq_call" && f.phone_checked_at) return `Veriq call, ${CALL_DAY.format(new Date(f.phone_checked_at))}`;
  if (f.phone_source === "nhia") return "NHIA list";
  return null;
}

/** The tel: href for a phone, or null when there is none or it is a demo placeholder. */
export function telHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/[\s()-]/g, "");
  if (!/^\+?\d{9,13}$/.test(digits) || PLACEHOLDER.test(digits)) return null;
  return `tel:${digits}`;
}
