// Small per-phone preferences in localStorage. Never sent anywhere.
const LAST_CARD_KEY = "veriq.lastCard";

/** The card type the person last searched with (e.g. "nhis"), shown in emergency mode as information. */
export function getLastCard(): string | null {
  try {
    return window.localStorage.getItem(LAST_CARD_KEY);
  } catch {
    return null;
  }
}

export function setLastCard(slug: string): void {
  try {
    window.localStorage.setItem(LAST_CARD_KEY, slug);
  } catch {
    // Private mode: nothing to remember.
  }
}

/** Everything this app keeps in localStorage, for "Make this phone fresh" on /admin/demo. */
export const LOCAL_STORAGE_KEYS = ["veriq.seenWelcome", "veriq.lastArea", LAST_CARD_KEY];
