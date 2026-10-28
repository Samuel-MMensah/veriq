// A tel: link only for a number that can really be called. Demo facilities carry the placeholder
// "+233 000 000 nnn" (reset_demo); Ghana numbers never start with 000 after the country code.
const PLACEHOLDER = /^(\+?233|0)0{2,}/;

/** The tel: href for a phone, or null when there is none or it is a demo placeholder. */
export function telHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/[\s()-]/g, "");
  if (!/^\+?\d{9,13}$/.test(digits) || PLACEHOLDER.test(digits)) return null;
  return `tel:${digits}`;
}
