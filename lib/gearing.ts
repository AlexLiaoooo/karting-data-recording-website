/**
 * Gear ratio from the two sprocket counts already recorded on every Run.
 *
 * Derived rather than stored. DESIGN.md section 5.5 offers "calculated or entered", and a stored
 * ratio can disagree with the sprockets it came from — the same failure a marker had when it kept
 * a copy of its corner's label instead of the corner's number. A function over the two fields
 * cannot drift, and it needs no migration: existing Runs already carry the sprockets.
 *
 * Both sprocket fields are free text, so everything here has to survive "", "12T", "0" and "abc".
 */

/** Rear divided by front, the karting convention: a 12 front and an 80 rear is 6.67. */
export function gearRatio(frontSprocket: string, rearSprocket: string): number | null {
  const front = Number(frontSprocket);
  const rear = Number(rearSprocket);
  const usable = (value: number, raw: string) => raw.trim() !== "" && Number.isFinite(value) && value > 0;
  if (!usable(front, frontSprocket) || !usable(rear, rearSprocket)) return null;
  return rear / front;
}

/** "6.67", or a dash when either sprocket is missing or not a usable number. */
export function formatRatio(frontSprocket: string, rearSprocket: string): string {
  const ratio = gearRatio(frontSprocket, rearSprocket);
  return ratio === null ? "—" : ratio.toFixed(2);
}

/**
 * How the gearing changed between two Runs, as a percentage and in the words a driver uses.
 *
 * "Shorter" means a higher ratio: more acceleration, less top speed. Saying that outright saves
 * the reader working out which way 6.67 to 6.75 went, which is the only reason to show the number
 * at all. A tooth on the rear is a little over one percent, so two decimals would be noise.
 */
export function ratioChange(from: { front: string; rear: string }, to: { front: string; rear: string }) {
  const before = gearRatio(from.front, from.rear);
  const after = gearRatio(to.front, to.rear);
  if (before === null || after === null) return null;

  const percent = ((after - before) / before) * 100;
  // Below a tenth of a percent no sprocket pair a kart can actually fit has changed anything;
  // treating it as unchanged avoids reporting "+0.0% shorter" on identical gearing.
  if (Math.abs(percent) < 0.05) return { percent: 0, direction: "same" as const };
  return { percent, direction: percent > 0 ? ("shorter" as const) : ("longer" as const) };
}
