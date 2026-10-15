import { describe, expect, it } from "vitest";
import { createRun } from "./types";
import { runLapTotal, runRecordingPhase } from "./run-recording";
import { normalizeAppData } from "./database";
import { makeAppData, makeEvent, makeRun, makeSession } from "./test-fixtures";
import { buildFullBackup, parseFullBackup } from "./track-map/backup";
import { emptyTrackMapData } from "./track-map/types";

describe("recorded lap totals", () => {
  it("counts whole laps, whitespace and genuine zero", () => {
    expect(runLapTotal([{ laps: "12" }, { laps: "0" }, { laps: " 003 " }])).toEqual({ laps: 15, missing: 0 });
  });
  it.each(["", " ", "-5", "2.5", "not recorded", "1e2", "0x10", "Infinity", "9007199254740992"])("keeps invalid %j out of totals without rewriting the record", laps => {
    const run = { laps };
    expect(runLapTotal([{ laps: "12" }, run])).toEqual({ laps: 12, missing: 1 });
    expect(run.laps).toBe(laps);
  });
  it("flags overflow rather than presenting an imprecise total", () => {
    expect(runLapTotal([{ laps: String(Number.MAX_SAFE_INTEGER) }, { laps: "1" }])).toEqual({ laps: null, missing: 0 });
    expect(runLapTotal([])).toEqual({ laps: 0, missing: 0 });
  });
});

describe("Run recording phases", () => {
  it("starts both blank and copied Runs in preparation without inheriting the old phase or results", () => {
    for (const run of [createRun(1), createRun(2, makeRun({ recordingPhase: "after" }))]) {
      expect(runRecordingPhase(run)).toBe("before");
      expect(run.completed).toBe(false);
      expect(run.tyres.fl.hotPressure).toBe("");
      expect(run.fastestLap).toBe("");
    }
  });

  it("opens an old blank or cold-only Run in preparation", () => {
    const run = createRun(1);
    delete run.recordingPhase;
    run.tyres.fl.coldPressure = "10.5";
    run.setup.rearSprocket = "82";
    expect(runRecordingPhase(run)).toBe("before");
  });

  it.each(["hotPressure", "hotTemperature"] as const)("opens old Runs with %s in the return view", (field) => {
    const run = createRun(1);
    delete run.recordingPhase;
    run.tyres.rr[field] = "12.5";
    expect(runRecordingPhase(run)).toBe("after");
  });

  it.each(["laps", "fastestLap", "maxRpm", "comments", "cornerEntry"] as const)("opens an old Run with %s in the return view", (field) => {
    const run = createRun(1);
    delete run.recordingPhase;
    run[field] = "Recorded result";
    expect(runRecordingPhase(run)).toBe("after");
  });

  it("opens completed legacy Runs after the Run but respects an explicitly chosen review view", () => {
    expect(runRecordingPhase(makeRun())).toBe("after");
    expect(runRecordingPhase(makeRun({ recordingPhase: "before" }))).toBe("before");
  });

  it("persists a phase with blank results through normalization and full backup restore", async () => {
    const run = { ...createRun(1), recordingPhase: "after" as const };
    const data = makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs: [run] })] })] });
    expect(normalizeAppData(data)?.events[0].sessions[0].runs[0]).toEqual(run);
    const backup = parseFullBackup(JSON.parse(await buildFullBackup(data, emptyTrackMapData())));
    expect(backup?.appData.events[0].sessions[0].runs[0]).toEqual(run);
  });

  it("accepts genuine old records and rejects an unknown or null recording phase", () => {
    expect(normalizeAppData(makeAppData())).not.toBeNull();
    for (const recordingPhase of ["unknown", null]) {
      const data = makeAppData();
      Object.assign(data.events[0].sessions[0].runs[0], { recordingPhase });
      expect(normalizeAppData(data)).toBeNull();
    }
  });
});
