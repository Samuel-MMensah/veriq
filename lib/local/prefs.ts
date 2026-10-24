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

const LAST_SEARCH_KEY = "veriq.lastSearch";

/** The last results query on this phone (rule 8), e.g. "service=antenatal&card=nhis&lat=…". */
export function getLastSearch(): URLSearchParams | null {
  try {
    const raw = window.localStorage.getItem(LAST_SEARCH_KEY);
    return raw ? new URLSearchParams(raw) : null;
  } catch {
    return null;
  }
}

export function setLastSearch(query: URLSearchParams): void {
  try {
    window.localStorage.setItem(LAST_SEARCH_KEY, query.toString());
  } catch {
    // Private mode: nothing to remember.
  }
}

/** Everything this app keeps in localStorage, for "Make this phone fresh" on /admin/demo. */
export const LOCAL_STORAGE_KEYS = ["veriq.seenWelcome", "veriq.lastArea", LAST_CARD_KEY, LAST_SEARCH_KEY];

/**
 * First open has been seen. A flag cookie (just "1", no identity, rule 2) lets the server send a
 * returning visitor straight to Find, instead of loading the welcome and then redirecting on 3G.
 */
export const SEEN_COOKIE = "veriq_seen";

export function setSeenCookie(): void {
  document.cookie = `${SEEN_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function clearSeenCookie(): void {
  document.cookie = `${SEEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
