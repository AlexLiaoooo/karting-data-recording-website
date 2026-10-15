import type { RunRecord, RunRecordingPhase } from "./types";
import { lapCount } from "./tyre-sets";

/** Match component/tyre counters while keeping unfinished and legacy Run text intact. */
export function runLapTotal(runs: ReadonlyArray<Pick<RunRecord, "laps">>) {
  let laps: number | null = 0; let missing = 0;
  for (const run of runs) {
    const count = lapCount(run.laps);
    if (count === null) missing += 1;
    else if (laps !== null) laps = Number.isSafeInteger(laps + count) ? laps + count : null;
  }
  return { laps, missing };
}

/** Older Runs need no destructive migration: use the measurements already on record. */
export function runRecordingPhase(run: RunRecord): RunRecordingPhase {
  if (run.recordingPhase) return run.recordingPhase;
  if (run.completed) return "after";
  const hasHotReadings = Object.values(run.tyres).some((tyre) =>
    tyre.hotPressure.trim() !== "" || tyre.hotTemperature.trim() !== "");
  const hasResults = [run.laps, run.fastestLap, run.averageLap, run.maxRpm, run.position,
    run.balance, run.grip, run.braking, run.cornerEntry, run.midCorner, run.cornerExit, run.comments]
    .some((value) => (value ?? "").trim() !== "");
  return hasHotReadings || hasResults ? "after" : "before";
}
