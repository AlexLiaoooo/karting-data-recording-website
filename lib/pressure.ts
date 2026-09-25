import type { TyreCorner, TyreReading } from "./types";

/**
 * What tyre pressures have done at a circuit, read out of past Runs.
 *
 * This describes and does not prescribe. The idea backlog is explicit that a pressure tool should
 * show patterns and comparable Runs, and should not claim to know the right pressure until there
 * is enough of the driver's own data to support it. So there is no target here, no fitted line and
 * no recommendation: only what the pressures actually did, grouped by the conditions they did it in,
 * with the number of Runs behind every figure so the reader can judge how much to trust it.
 */

/** One Run's tyres, with the conditions the Session actually ran in. */
export type PressureRun = {
  tyres: Record<TyreCorner, TyreReading>;
  condition: string;
  trackTemperature: string;
  ambientTemperature: string;
  /** The Event's start date, ISO yyyy-mm-dd. */
  date: string;
  eventName: string;
  sessionName: string;
  runNumber: number;
};

export type PressureRow = {
  /** Hot minus cold for each corner, in PSI, or null where either reading is missing. */
  gains: Record<TyreCorner, number | null>;
  /** The mean of whichever of that axle's two corners have a gain. */
  front: number | null;
  rear: number | null;
  condition: string;
  trackTemperature: number | null;
  ambientTemperature: number | null;
  date: string;
  eventName: string;
  sessionName: string;
  runNumber: number;
};

/** An axle's gain across several Runs. */
export type AxleSummary = { min: number; max: number; mean: number; runs: number };

export type ConditionGroup = {
  condition: string;
  front: AxleSummary | null;
  rear: AxleSummary | null;
  trackTemperature: { min: number; max: number } | null;
  /** Ordered by track temperature, so rising temperature and rising gain line up on screen. */
  rows: PressureRow[];
};

const CORNERS: TyreCorner[] = ["fl", "fr", "rl", "rr"];

/**
 * Dry first, then in increasing wetness. Grouping by condition is not optional: a wet Run gains
 * far less than a dry one, so pooling them produces an average that describes neither.
 */
const CONDITION_ORDER = ["Dry", "Damp", "Wet", "Mixed"];

/** A number typed into a free-text field, or null. Temperatures may be below zero. */
function reading(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Hot minus cold for one tyre, or null when either is missing.
 *
 * A pressure has to be positive to be a pressure, so a zero or negative reading is refused as a
 * mistyped field. A negative gain is not refused: hot below cold is odd, and exactly the kind of
 * reading the driver should see rather than have quietly dropped.
 */
export function pressureGain(tyre: TyreReading): number | null {
  const cold = reading(tyre.coldPressure);
  const hot = reading(tyre.hotPressure);
  if (cold === null || hot === null || cold <= 0 || hot <= 0) return null;
  return hot - cold;
}

/**
 * Hot minus cold tyre temperature, or null when either is missing.
 *
 * The same subtraction as pressureGain without its positivity check: a pressure of zero is a
 * mistyped field, but a tyre can genuinely be at or below 0 °C before a winter session.
 */
export function temperatureGain(tyre: TyreReading): number | null {
  const cold = reading(tyre.coldTemperature);
  const hot = reading(tyre.hotTemperature);
  return cold === null || hot === null ? null : hot - cold;
}

/**
 * A gain to one decimal, signed: "+2.4", "-0.5", "0.0". Every screen writes a pressure or
 * temperature gain through this, so one Run's gain reads the same wherever it appears.
 *
 * Rounds half away from zero, with a small allowance for binary arithmetic. Without it, 12.7 minus
 * 12.0 comes out as 0.69999…, so an axle whose corners read +0.7 and +0.6 averages to 0.6499… and
 * displays as +0.6 right beside the two figures a reader would average to +0.7 themselves. The
 * allowance is far below any gauge's resolution, so it only ever settles a case that was genuinely
 * on the half.
 */
export function formatGain(value: number): string {
  const rounded = (Math.sign(value) * Math.round(Math.abs(value) * 10 + 1e-9)) / 10;
  if (rounded === 0) return "0.0";
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;

function axle(gains: Record<TyreCorner, number | null>, corners: [TyreCorner, TyreCorner]): number | null {
  const present = corners.map((corner) => gains[corner]).filter((gain): gain is number => gain !== null);
  return present.length ? mean(present) : null;
}

function summarise(values: Array<number | null>): AxleSummary | null {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return null;
  return { min: Math.min(...present), max: Math.max(...present), mean: mean(present), runs: present.length };
}

/**
 * The Run whose track temperature is closest to the one given, or null when there is nothing to
 * measure against.
 *
 * This is the backlog's "similar historical conditions", kept deliberately literal: the nearest
 * temperature, not a weighted blend of several Runs and not a prediction. A tie goes to the more
 * recent Run, since a circuit's surface changes over a season. A Run with no track temperature is
 * neither near nor far from anything, so it is never the answer.
 */
export function closestByTemperature(rows: PressureRow[], trackTemperature: number | null): PressureRow | null {
  if (trackTemperature === null) return null;
  let best: PressureRow | null = null;
  let bestGap = Infinity;
  for (const row of rows) {
    if (row.trackTemperature === null) continue;
    const gap = Math.abs(row.trackTemperature - trackTemperature);
    if (gap < bestGap || (gap === bestGap && best !== null && row.date > best.date)) {
      best = row;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * Groups Runs by the condition they ran in and summarises each axle's gain.
 *
 * A Run counts only if at least one corner has both a cold and a hot pressure, since a Run with no
 * gain anywhere tells this view nothing.
 */
export function summarisePressure(runs: PressureRun[]): ConditionGroup[] {
  const rows: PressureRow[] = [];

  for (const run of runs) {
    const gains = Object.fromEntries(CORNERS.map((corner) => [corner, pressureGain(run.tyres[corner])])) as Record<TyreCorner, number | null>;
    if (CORNERS.every((corner) => gains[corner] === null)) continue;

    rows.push({
      gains,
      front: axle(gains, ["fl", "fr"]),
      rear: axle(gains, ["rl", "rr"]),
      condition: run.condition,
      trackTemperature: reading(run.trackTemperature),
      ambientTemperature: reading(run.ambientTemperature),
      date: run.date,
      eventName: run.eventName,
      sessionName: run.sessionName,
      runNumber: run.runNumber,
    });
  }

  const conditions = [...new Set(rows.map((row) => row.condition))].sort((a, b) => {
    const rank = (condition: string) => (CONDITION_ORDER.includes(condition) ? CONDITION_ORDER.indexOf(condition) : CONDITION_ORDER.length);
    return rank(a) - rank(b) || a.localeCompare(b);
  });

  return conditions.map((condition) => {
    const group = rows
      .filter((row) => row.condition === condition)
      // Coolest first; a Run with no track temperature goes last, most recent first among those.
      .sort((a, b) => {
        if (a.trackTemperature === null && b.trackTemperature === null) return b.date.localeCompare(a.date);
        if (a.trackTemperature === null) return 1;
        if (b.trackTemperature === null) return -1;
        return a.trackTemperature - b.trackTemperature || b.date.localeCompare(a.date);
      });
    const temperatures = group.map((row) => row.trackTemperature).filter((value): value is number => value !== null);

    return {
      condition,
      front: summarise(group.map((row) => row.front)),
      rear: summarise(group.map((row) => row.rear)),
      trackTemperature: temperatures.length ? { min: Math.min(...temperatures), max: Math.max(...temperatures) } : null,
      rows: group,
    };
  });
}
