type PreferenceKey = "kart-data-language" | "kart-data-theme";
const sessionChoices = new Map<PreferenceKey, string>();

/** A settings-storage failure must never prevent recording or changing a preference. */
export function readPreference(key: PreferenceKey): string | null {
  if (sessionChoices.has(key)) return sessionChoices.get(key)!;
  try { return localStorage.getItem(key); }
  catch { return null; }
}

export function writePreference(key: PreferenceKey, value: string) {
  sessionChoices.set(key, value);
  try { localStorage.setItem(key, value); }
  catch { /* Keep the choice for this page session when persistence is unavailable. */ }
}
