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

/** One Run's gearing, with the context needed to say when and in what it was used. */
export type GearingRun = {
  front: string;
  rear: string;
  fastestLap: string;
  maxRpm: string;
  condition: string;
  /** The Event's start date, ISO yyyy-mm-dd, used only for ordering and display. */
  date: string;
  eventName: string;
};

/** Every Run that shared one sprocket pair, collapsed into a single row. */
export type GearingSummary = {
  front: string;
  rear: string;
  ratio: number;
  runs: number;
  /** Fastest lap across those Runs, or "" if none was recorded as a plain number. */
  bestLap: string;
  /** Highest RPM seen on this gearing, or "" if none was recorded. */
  maxRpm: string;
  /** Distinct track conditions it was run in, in the order first seen. */
  conditions: string[];
  lastUsed: string;
  lastEvent: string;
};

/**
 * A number typed into a free-text field, or null.
 *
 * Lap times are stored as text, so a lap entered as "1:02.5" is not a number and is left out of
 * the best-lap figure rather than becoming NaN. That the app cannot read such a lap at all is a
 * separate fault; this function only declines to make it worse.
 */
function numeric(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Groups Runs by the sprockets they used, most recently used first.
 *
 * Grouped by the sprocket pair rather than by the ratio, because the pair is what gets fitted:
 * 12/80 and 6/40 are the same gearing and not the same afternoon's work. Runs with no usable
 * gearing are left out entirely, since a row with no sprockets answers nothing.
 */
export function summariseGearing(runs: GearingRun[]): GearingSummary[] {
  const groups = new Map<string, GearingSummary & { laps: number[]; rpms: number[] }>();

  for (const run of runs) {
    const ratio = gearRatio(run.front, run.rear);
    if (ratio === null) continue;

    const key = `${run.front}/${run.rear}`;
    const group = groups.get(key) ?? {
      front: run.front, rear: run.rear, ratio, runs: 0,
      bestLap: "", maxRpm: "", conditions: [], lastUsed: "", lastEvent: "",
      laps: [], rpms: [],
    };

    group.runs += 1;
    const lap = numeric(run.fastestLap);
    if (lap !== null) group.laps.push(lap);
    const rpm = numeric(run.maxRpm);
    if (rpm !== null) group.rpms.push(rpm);
    if (run.condition && !group.conditions.includes(run.condition)) group.conditions.push(run.condition);
    if (run.date >= group.lastUsed) {
      group.lastUsed = run.date;
      group.lastEvent = run.eventName;
    }

    groups.set(key, group);
  }

  return [...groups.values()]
    .map(({ laps, rpms, ...group }) => ({
      ...group,
      bestLap: laps.length ? String(Math.min(...laps)) : "",
      maxRpm: rpms.length ? String(Math.max(...rpms)) : "",
    }))
    // Most recent first: the question is usually "what did I run here last time".
    .sort((a, b) => (b.lastUsed === a.lastUsed ? a.ratio - b.ratio : b.lastUsed.localeCompare(a.lastUsed)));
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
