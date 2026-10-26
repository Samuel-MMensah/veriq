// The NHIA file writes names and places in capitals ("DANSOMAN POLYCLINIC"). On screen they read
// in title case ("Dansoman Polyclinic"), which is easier on a small screen (rule 9). Only the case
// changes; every word stays as the file has it (rule D1). Demo names are already mixed case and
// pass through unchanged.

/** Short forms the file uses that stay in capitals. */
const KEEP_UPPER = new Set(["GBC", "MDS", "PML", "CHPS", "SDA", "AME", "UN", "KNUST", "VALCO", "LEKMA", "GPRTU", "UTC", "ECG", "SSNIT", "GAF", "UK", "USA", "II", "III", "IV"]);
const KEEP_LOWER = new Set(["of", "and", "the", "at", "by", "for", "on", "in"]);

function word(w: string, first: boolean): string {
  if (KEEP_UPPER.has(w)) return w;
  const lower = w.toLowerCase();
  if (!first && KEEP_LOWER.has(lower)) return lower;
  // Inside a word, keep parts joined by - ' / & each capitalised: "KORLE-BU" reads "Korle-Bu".
  return lower.replace(/(^|[-'/&(.])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** "DANSOMAN POLYCLINIC" reads "Dansoman Polyclinic"; mixed-case text is left as it is. */
export function displayName(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return text
    .split(" ")
    .map((w, i) => word(w, i === 0))
    .join(" ");
}

/** The district as a place name: "OSU KLOTTEY" reads "Osu Klottey". */
export function displayPlace(text: string | null): string | null {
  return text === null ? null : displayName(text);
}
