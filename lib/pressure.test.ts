import { describe, expect, it } from "vitest";
import { formatGain, pressureGain, summarisePressure, type PressureRun } from "./pressure";
import type { TyreReading } from "./types";

const tyre = (cold: string, hot: string): TyreReading => ({ coldPressure: cold, hotPressure: hot, coldTemperature: "", hotTemperature: "" });

const run = (overrides: Partial<PressureRun> = {}): PressureRun => ({
  tyres: { fl: tyre("10.0", "12.5"), fr: tyre("10.0", "12.3"), rl: tyre("11.0", "13.0"), rr: tyre("11.0", "12.8") },
  condition: "Dry",
  trackTemperature: "24",
  ambientTemperature: "18",
  date: "2026-08-16",
  eventName: "Club Round 4",
  sessionName: "Heat 1",
  runNumber: 1,
  ...overrides,
});

describe("pressureGain", () => {
  it("is hot minus cold", () => {
    expect(pressureGain(tyre("10.0", "12.5"))).toBeCloseTo(2.5, 6);
  });

  it("is null when either reading is missing", () => {
    expect(pressureGain(tyre("", "12.5"))).toBeNull();
    expect(pressureGain(tyre("10.0", ""))).toBeNull();
    expect(pressureGain(tyre("10.0", "abc"))).toBeNull();
  });

  it("refuses a zero or negative pressure as a mistyped field", () => {
    expect(pressureGain(tyre("0", "12.5"))).toBeNull();
    expect(pressureGain(tyre("-10", "12.5"))).toBeNull();
  });

  /** Odd, but a real reading the driver should see, not have quietly dropped. */
  it("reports a negative gain rather than hiding it", () => {
    expect(pressureGain(tyre("12.0", "11.5"))).toBeCloseTo(-0.5, 6);
  });
});

describe("formatGain", () => {
  it("signs a gain and gives it one decimal", () => {
    expect(formatGain(2.4)).toBe("+2.4");
    expect(formatGain(-0.5)).toBe("-0.5");
  });

  it("writes no gain as 0.0, never as -0.0", () => {
    expect(formatGain(0)).toBe("0.0");
    expect(formatGain(-0.01)).toBe("0.0");
  });

  /**
   * Found in the browser: FL +0.7 and FR +0.6 averaged to a displayed +0.6, because binary
   * arithmetic makes the mean 0.6499… instead of 0.65. Built from the same subtraction the app
   * does, not from a literal, since the literal 0.65 would not reproduce it.
   */
  it("rounds a mean that is genuinely on the half upwards, despite binary arithmetic", () => {
    const front = ((12.7 - 12.0) + (12.6 - 12.0)) / 2;
    expect(front).toBeLessThan(0.65);
    expect(formatGain(front)).toBe("+0.7");

    const rear = ((13.2 - 11.0) + (13.1 - 11.0)) / 2;
    expect(formatGain(rear)).toBe("+2.2");
  });

  it("rounds a negative half away from zero, as a positive one is", () => {
    expect(formatGain(-0.65)).toBe("-0.7");
  });
});

describe("summarisePressure", () => {
  it("averages each axle's two corners for a Run", () => {
    const [group] = summarisePressure([run()]);

    expect(group.rows[0].front).toBeCloseTo(2.4, 6);
    expect(group.rows[0].rear).toBeCloseTo(1.9, 6);
  });

  it("uses whichever corner of an axle has a reading when the other does not", () => {
    const [group] = summarisePressure([run({ tyres: { fl: tyre("10.0", "12.6"), fr: tyre("", ""), rl: tyre("", ""), rr: tyre("", "") } })]);

    expect(group.rows[0].front).toBeCloseTo(2.6, 6);
    expect(group.rows[0].rear).toBeNull();
  });

  it("gives each axle a range, a mean and the number of Runs behind it", () => {
    const [group] = summarisePressure([
      run({ tyres: { fl: tyre("10", "12"), fr: tyre("10", "12"), rl: tyre("11", "12.5"), rr: tyre("11", "12.5") } }),
      run({ tyres: { fl: tyre("10", "13"), fr: tyre("10", "13"), rl: tyre("11", "13"), rr: tyre("11", "13") } }),
    ]);

    expect(group.front).toEqual({ min: 2, max: 3, mean: 2.5, runs: 2 });
    expect(group.rear).toEqual({ min: 1.5, max: 2, mean: 1.75, runs: 2 });
  });

  /**
   * The reason for grouping at all. A wet Run gains far less than a dry one, so a pooled average
   * would describe neither.
   */
  it("keeps dry and wet Runs apart, dry first", () => {
    const groups = summarisePressure([
      run({ condition: "Wet", tyres: { fl: tyre("12", "12.8"), fr: tyre("12", "12.8"), rl: tyre("12", "12.5"), rr: tyre("12", "12.5") } }),
      run({ condition: "Dry" }),
    ]);

    expect(groups.map((group) => group.condition)).toEqual(["Dry", "Wet"]);
    expect(groups[1].front!.mean).toBeCloseTo(0.8, 6);
  });

  it("orders a condition's Runs by track temperature, coolest first", () => {
    const [group] = summarisePressure([
      run({ trackTemperature: "31", runNumber: 3 }),
      run({ trackTemperature: "18", runNumber: 1 }),
      run({ trackTemperature: "24", runNumber: 2 }),
    ]);

    expect(group.rows.map((row) => row.runNumber)).toEqual([1, 2, 3]);
    expect(group.trackTemperature).toEqual({ min: 18, max: 31 });
  });

  it("puts a Run with no track temperature last rather than dropping it", () => {
    const [group] = summarisePressure([run({ trackTemperature: "", runNumber: 9 }), run({ trackTemperature: "20", runNumber: 1 })]);

    expect(group.rows.map((row) => row.runNumber)).toEqual([1, 9]);
    expect(group.rows[1].trackTemperature).toBeNull();
  });

  it("reads a track temperature below zero", () => {
    const [group] = summarisePressure([run({ trackTemperature: "-2" })]);

    expect(group.rows[0].trackTemperature).toBe(-2);
  });

  /** A Run with no gain on any corner tells this view nothing, so it is not a row. */
  it("leaves out a Run with no complete reading on any corner", () => {
    const blank = { fl: tyre("10", ""), fr: tyre("", "12"), rl: tyre("", ""), rr: tyre("", "") };

    expect(summarisePressure([run({ tyres: blank })])).toEqual([]);
  });

  it("returns nothing for no Runs", () => {
    expect(summarisePressure([])).toEqual([]);
  });
});
