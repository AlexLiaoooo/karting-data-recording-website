import { describe, expect, it } from "vitest";
import { normalizeAppData } from "./database";
import { createRun, emptyExperiment } from "./types";
import { recordedRuns, hasExperiment, experimentComparison } from "./experiments";
import { makeAppData, makeEvent, makeRun, makeSession, parseCsvRow } from "./test-fixtures";
import { buildFullBackup, parseFullBackup } from "./track-map/backup";
import { emptyTrackMapData } from "./track-map/types";
import { buildCsv } from "./csv";

const experiment = { baselineRunId: "baseline", change: "Rear width +5mm", expectation: "Less exit understeer", outcome: "Exit improved; more sliding mid-corner" };
const dataWith = (value: unknown) => {
  const data = makeAppData();
  Object.assign(data.events[0].sessions[0].runs[0], { experiment: value });
  return data;
};

describe("setup experiments", () => {
  it("keeps legacy Runs valid and does not invent entries on blank or copied Runs", () => {
    expect(normalizeAppData(makeAppData())).not.toBeNull();
    const source = makeRun({ experiment });
    for (const run of [createRun(1), createRun(2, source)]) {
      expect(run.experiment).toBeUndefined();
      expect(hasExperiment(run)).toBe(false);
    }
    expect(hasExperiment(makeRun({ experiment: emptyExperiment() }))).toBe(false);
    expect(hasExperiment(source)).toBe(true);
    expect(hasExperiment(makeRun({ experiment: { ...emptyExperiment(), outcome: "Observed" } }))).toBe(true);
  });

  it.each([null, [], { ...experiment, change: 3 }, { ...experiment, expectation: null },
    { ...experiment, outcome: [] }, { ...experiment, baselineRunId: "" },
    { ...experiment, baselineRunId: "run-1" }, { change: "Note" },
  ])("rejects malformed or self-linked journal data: %j", value => {
    expect(normalizeAppData(dataWith(value))).toBeNull();
  });

  it("round-trips notes and links, retaining notes if a baseline was deleted", async () => {
    const data = dataWith(experiment);
    const backup = parseFullBackup(JSON.parse(await buildFullBackup(data, emptyTrackMapData())));
    expect(backup?.appData.events[0].sessions[0].runs[0].experiment).toEqual(experiment);
    expect(normalizeAppData(dataWith({ ...experiment, baselineRunId: null }))).not.toBeNull();
  });

  it("resolves Session overrides and cross-Event context beside linked lap results", () => {
    const events = [makeEvent(), makeEvent({ id: "event-2", track: "Whilton Mill", sessions: [makeSession({
      id: "session-2", condition: "Wet", trackTemperature: "14", runs: [makeRun({ id: "test", fastestLap: "1:02.500" })],
    })] })];
    const [baseline, test] = recordedRuns(events);
    expect(test.conditions).toMatchObject({ condition: "Wet", trackTemperature: "14", ambientTemperature: "19" });
    expect(test).toMatchObject({ eventId: "event-2", sessionId: "session-2", track: "Whilton Mill" });
    expect(experimentComparison(test, baseline)).toMatchObject({ lapDelta: 14.29, differentConditions: true, differentTrack: true });
  });

  it("does not turn missing laps into zero; identifies different layouts and unknown circuits", () => {
    const [entry] = recordedRuns([makeEvent()]);
    const test = { ...entry, trackLayoutId: "short", run: makeRun({ fastestLap: "" }) };
    expect(experimentComparison(test, { ...entry, trackLayoutId: "full" })).toMatchObject({ lapDelta: null, differentTrack: true });
    expect(experimentComparison({ ...test, track: "" }, entry).unknownTrack).toBe(true);
  });

  it("exports linkable Run IDs and all notes without shifting measurement columns", () => {
    const rows = buildCsv(dataWith(experiment), emptyTrackMapData()).replace(/^\uFEFF/, "").split("\r\n").slice(0, 2).map(parseCsvRow);
    const row = Object.fromEntries(rows[0].map((header, index) => [header, rows[1][index]]));
    expect(row).toMatchObject({ "Run ID": "run-1", "Baseline Run ID": "baseline", "Experiment change": experiment.change,
      "Experiment expectation": experiment.expectation, "Experiment outcome": experiment.outcome, "FL cold pressure (PSI)": "10.0" });
    expect(rows[1]).toHaveLength(rows[0].length);
  });
});
