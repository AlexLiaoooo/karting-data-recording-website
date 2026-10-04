/**
 * "1 layout", "3 layouts".
 *
 * The counted nouns of the data model — Event, Session, Run, Track, Layout, Marker — stay English
 * in both languages by the convention in lib/i18n.tsx, so this is plain English grammar rather
 * than something to translate. Counts were previously interpolated straight into a plural noun,
 * which read "1 layouts" wherever a track had exactly one.
 */
export function counted(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Calendar date on the device, rather than UTC's date near midnight. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
