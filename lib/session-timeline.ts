import { gearRatio } from "./gearing";
import { parseLapTime } from "./lap-time";
import { pressureGain } from "./pressure";
import type { ChassisSetup, RunRecord, TyreCorner } from "./types";

export type TimelineMetric = "laps" | "pressure" | "temperature" | "gearing";
export type TemperatureView = "cold" | "hot";
export type RunSeries = { key: string; label: string; values: Array<number | null> };
export type RecordedChange = { label: string; corner?: TyreCorner; before: string; after: string; unit?: string };

export const timelineCorners: TyreCorner[] = ["fl", "fr", "rl", "rr"];
const setupLabels: Array<[keyof ChassisSetup, string]> = [
  ["frontTrack", "Front track / spacers"], ["rearTrack", "Rear track width"],
  ["frontRideHeight", "Front ride height"], ["rearRideHeight", "Rear ride height"],
  ["frontToe", "Front toe"], ["frontCamber", "Front camber"], ["caster", "Caster"],
  ["axleType", "Axle type"], ["rearHub", "Rear hub"], ["frontTorsionBar", "Front torsion bar"],
  ["seatStays", "Seat stays"], ["frontSprocket", "Front sprocket"], ["rearSprocket", "Rear sprocket"],
  ["wheelType", "Wheel / rim type"], ["notes", "Setup notes"],
];

/** Run numbers describe the recorded sequence; deleted Runs are never inserted as empty records. */
export function orderedSessionRuns(runs: RunRecord[]): RunRecord[] {
  return [...runs].sort((a, b) => a.number - b.number);
}

const finite = (value: number | null) => value !== null && Number.isFinite(value) ? value : null;
function temperature(value: string): number | null {
  return value.trim() ? finite(Number(value)) : null;
}

/** One value per actual Run. A null is unknown, and must break the drawn line. */
export function sessionSeries(runs: RunRecord[], metric: TimelineMetric, view: TemperatureView = "hot"): RunSeries[] {
  if (metric === "laps") return [
    { key: "fastest", label: "Fastest lap", values: runs.map(run => parseLapTime(run.fastestLap)) },
    { key: "average", label: "Average lap", values: runs.map(run => parseLapTime(run.averageLap)) },
  ];
  if (metric === "gearing") return [{
    key: "ratio", label: "Gear ratio", values: runs.map(run => finite(gearRatio(run.setup.frontSprocket, run.setup.rearSprocket))),
  }];
  return timelineCorners.map(corner => ({
    key: corner, label: corner.toUpperCase(), values: runs.map(run => metric === "pressure"
      ? finite(pressureGain(run.tyres[corner])) : temperature(run.tyres[corner][view === "hot" ? "hotTemperature" : "coldTemperature"])),
  }));
}

/** Separates runs of measured points instead of implying a measurement across a missing Run. */
export function measuredSegments(values: Array<number | null>): Array<Array<{ index: number; value: number }>> {
  const segments: Array<Array<{ index: number; value: number }>> = [];
  let segment: Array<{ index: number; value: number }> = [];
  for (let index = 0; index < values.length; index++) {
    const value = finite(values[index]);
    if (value === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else segment.push({ index, value });
  }
  if (segment.length) segments.push(segment);
  return segments;
}

/** Normalized coordinates keep a constant reading and very large valid readings drawable. */
export function chartScale(series: RunSeries[], includeZero = false) {
  let low = Infinity;
  let high = -Infinity;
  for (const item of series) for (const value of item.values) {
    if (value === null || !Number.isFinite(value)) continue;
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  if (low === Infinity) return null;
  if (includeZero) { low = Math.min(0, low); high = Math.max(0, high); }
  const factor = Math.max(Math.abs(low), Math.abs(high), 1);
  const floor = low / factor;
  const ceiling = high / factor;
  const padding = (ceiling - floor) * 0.08 || 0.1;
  const limit = Number.MAX_VALUE / factor;
  const minimum = Math.max(-limit, floor - padding);
  const maximum = Math.min(limit, ceiling + padding);
  return { factor, minimum, maximum };
}

/** Describes differences in records, including a newly filled or cleared field, without guessing why. */
export function changesFromPrevious(previous: RunRecord, run: RunRecord): RecordedChange[] {
  const changes: RecordedChange[] = [];
  for (const [key, label] of setupLabels) {
    const before = previous.setup[key].trim();
    const after = run.setup[key].trim();
    if (before !== after) changes.push({ label, before, after });
  }
  for (const corner of timelineCorners) {
    const before = previous.tyres[corner].coldPressure.trim();
    const after = run.tyres[corner].coldPressure.trim();
    if (before !== after) changes.push({ label: "Cold pressure", corner, before, after, unit: "PSI" });
  }
  return changes;
}
