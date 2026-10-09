import type { RunRecord, RunRecordingPhase } from "./types";

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
