import { describe, expect, it } from "vitest";
import { makeRun } from "./test-fixtures";
import { createRun } from "./types";
import { chartScale, changesFromPrevious, measuredSegments, orderedSessionRuns, sessionSeries } from "./session-timeline";

describe("Session timeline measurements", () => {
  it("orders actual Runs by number without mutating records or filling deleted numbers", () => {
    const runs = [makeRun({ number: 7 }), makeRun({ number: 1 }), makeRun({ number: 4 })];
    expect(orderedSessionRuns(runs).map(run => run.number)).toEqual([1, 4, 7]);
    expect(runs.map(run => run.number)).toEqual([7, 1, 4]);
  });

  it("reads minute lap times and preserves missing and invalid results as unknown", () => {
    const runs = [makeRun({ fastestLap: "1:02.500", averageLap: "63.1" }), createRun(2), makeRun({ fastestLap: "0", averageLap: "pit stop" })];
    expect(sessionSeries(runs, "laps").map(series => series.values)).toEqual([[62.5, null, null], [63.1, null, null]]);
  });

  it("uses valid measured pressure gains, including zero and negative gains", () => {
    const run = makeRun();
    run.tyres.fr = { ...run.tyres.fl, coldPressure: "12.5", hotPressure: "12.5" };
    run.tyres.rl = { ...run.tyres.fl, coldPressure: "13", hotPressure: "12.5" };
    run.tyres.rr = { ...run.tyres.fl, coldPressure: "0" };
    expect(sessionSeries([run], "pressure").map(series => series.values[0])).toEqual([2.5, 0, -0.5, null]);
  });

  it("distinguishes missing temperatures from genuine zero and winter cold temperatures", () => {
    const run = createRun(1);
    run.tyres.fl.coldTemperature = "-2";
    run.tyres.fr.coldTemperature = "0";
    run.tyres.rl.coldTemperature = "not measured";
    run.tyres.fl.hotTemperature = "48";
    expect(sessionSeries([run], "temperature", "cold").map(series => series.values[0])).toEqual([-2, 0, null, null]);
    expect(sessionSeries([run], "temperature", "hot").map(series => series.values[0])).toEqual([48, null, null, null]);
  });

  it("derives gearing from both sprockets and rejects missing, zero and overflowing ratios", () => {
    const runs = [makeRun(), createRun(2), makeRun(), makeRun()];
    runs[2].setup.frontSprocket = "0";
    runs[3].setup.frontSprocket = "1e-308";
    runs[3].setup.rearSprocket = "1e308";
    expect(sessionSeries(runs, "gearing")[0].values).toEqual([82 / 11, null, null, null]);
  });

  it("breaks a line at missing readings but keeps isolated measured points", () => {
    expect(measuredSegments([2.5, null, 0, -0.5, null, 1])).toEqual([
      [{ index: 0, value: 2.5 }], [{ index: 2, value: 0 }, { index: 3, value: -0.5 }], [{ index: 5, value: 1 }],
    ]);
  });

  it("has no scale for blank data and a finite usable range for flat and extreme data", () => {
    expect(chartScale(sessionSeries([createRun(1)], "laps"))).toBeNull();
    for (const values of [[0], [48, 48], [-Number.MAX_VALUE, Number.MAX_VALUE], [Number.MAX_VALUE]]) {
      const scale = chartScale([{ key: "test", label: "Test", values }])!;
      expect(Number.isFinite(scale.factor)).toBe(true);
      expect(scale.maximum).toBeGreaterThan(scale.minimum);
      for (const value of values) expect(value / scale.factor).toBeGreaterThanOrEqual(scale.minimum);
      expect(Number.isFinite(scale.maximum * scale.factor)).toBe(true);
    }
  });

  it("shows a completed Run's measurements alongside unfinished Runs without inventing completion", () => {
    const runs = [makeRun(), makeRun({ id: "test", completed: false, fastestLap: "48.0" })];
    expect(sessionSeries(runs, "laps")[0].values).toEqual([48.21, 48]);
    expect(runs[1].completed).toBe(false);
  });

  it("reports changed, added and cleared setup/cold pressure fields, omitting unchanged and hot readings", () => {
    const baseline = makeRun();
    const test = structuredClone(baseline);
    test.setup.rearSprocket = "84";
    test.setup.axleType = "Medium";
    test.setup.frontSprocket = "";
    test.tyres.fl.coldPressure = "10.5";
    test.tyres.fr.hotPressure = "13";
    expect(changesFromPrevious(baseline, test)).toEqual([
      { label: "Axle type", before: "", after: "Medium" },
      { label: "Front sprocket", before: "11", after: "" },
      { label: "Rear sprocket", before: "82", after: "84" },
      { label: "Cold pressure", corner: "fl", before: "10.0", after: "10.5", unit: "PSI" },
    ]);
    expect(changesFromPrevious(baseline, structuredClone(baseline))).toEqual([]);
    test.setup.rearSprocket = " 82 ";
    expect(changesFromPrevious(baseline, test).some(change => change.label === "Rear sprocket")).toBe(false);
  });
});
