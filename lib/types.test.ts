import { describe, expect, it } from "vitest";
import { createRun } from "./types";
import { makeRun } from "./test-fixtures";

describe("createRun", () => {
  it("starts a Run with every tyre field blank when there is nothing to copy", () => {
    const run = createRun(1);

    for (const corner of ["fl", "fr", "rl", "rr"] as const) {
      expect(run.tyres[corner]).toEqual({ coldPressure: "", hotPressure: "", coldTemperature: "", hotTemperature: "" });
    }
  });

  /**
   * The fault this covers: duplicating a Run used to clone all four tyres whole, so the new Run
   * opened already holding the previous Run's hot pressures and temperatures. On screen they were
   * indistinguishable from readings actually taken, and they reached every export and comparison
   * unless someone noticed and cleared all eight.
   */
  it("carries the cold readings forward and leaves the hot ones blank", () => {
    const previous = makeRun({
      tyres: {
        fl: { coldPressure: "10.0", hotPressure: "12.5", coldTemperature: "18", hotTemperature: "48" },
        fr: { coldPressure: "10.2", hotPressure: "12.7", coldTemperature: "18", hotTemperature: "49" },
        rl: { coldPressure: "11.0", hotPressure: "13.1", coldTemperature: "19", hotTemperature: "51" },
        rr: { coldPressure: "11.1", hotPressure: "13.2", coldTemperature: "19", hotTemperature: "52" },
      },
    });

    const run = createRun(2, previous);

    expect(run.tyres.fl).toEqual({ coldPressure: "10.0", hotPressure: "", coldTemperature: "18", hotTemperature: "" });
    expect(run.tyres.rr).toEqual({ coldPressure: "11.1", hotPressure: "", coldTemperature: "19", hotTemperature: "" });
    for (const corner of ["fl", "fr", "rl", "rr"] as const) {
      expect(run.tyres[corner].hotPressure, corner).toBe("");
      expect(run.tyres[corner].hotTemperature, corner).toBe("");
    }
  });

  it("still copies the chassis setup, which is the other half of duplicating a Run", () => {
    const previous = makeRun();
    const run = createRun(2, previous);

    expect(run.setup).toEqual(previous.setup);
    expect(run.setup).not.toBe(previous.setup);
  });

  /** Editing the new Run's tyres must not reach back into the Run it was copied from. */
  it("copies the readings rather than sharing them", () => {
    const previous = makeRun();
    const run = createRun(2, previous);
    run.tyres.fl.coldPressure = "9.0";

    expect(previous.tyres.fl.coldPressure).toBe("10.0");
  });

  it("leaves performance and feedback blank, so nothing is inherited as if measured", () => {
    const run = createRun(2, makeRun());

    expect(run.fastestLap).toBe("");
    expect(run.averageLap).toBe("");
    expect(run.maxRpm).toBe("");
    expect(run.position).toBe("");
    expect(run.balance).toBe("");
    expect(run.completed).toBe(false);
  });
});
