/**
 * Reading and writing lap times.
 *
 * Lap times are stored as free text, and every figure computed from them went through Number().
 * That reads "52.400" and returns NaN for "1:02.5", so a lap over a minute was silently dropped
 * from the session best, from the fastest-lap delta in a comparison, and from the gearing history
 * — not flagged, just absent. Wet sessions and cadet classes produce such laps routinely, and at
 * several of the built-in circuits every lap is over a minute.
 *
 * Both notations stay valid input. Nobody should have to learn which one the app prefers.
 */

/** Seconds, or null when the text is not a lap time. */
export function parseLapTime(value: string): number | null {
  const text = value.trim();
  if (!text) return null;

  const clock = text.match(/^(\d+):([0-5]?\d(?:\.\d+)?)$/);
  if (clock) {
    const seconds = Number(clock[1]) * 60 + Number(clock[2]);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  // Plain seconds, including the "62.5" some people type for a lap over a minute.
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const seconds = Number(text);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/**
 * Seconds back to text, in the notation a timing screen uses.
 *
 * Under a minute stays plain seconds, because that is how a kart lap is quoted and read aloud.
 * At or over a minute it becomes m:ss.mmm, where "62.500" would otherwise have to be converted
 * in the reader's head.
 */
export function formatLapTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return seconds.toFixed(3);

  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(3)}`;
}
