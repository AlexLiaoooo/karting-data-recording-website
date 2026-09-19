import { describe, expect, it } from "vitest";
import { formatRatio, gearRatio, ratioChange, summariseGearing, type GearingRun } from "./gearing";

const run = (overrides: Partial<GearingRun> = {}): GearingRun => ({
  front: "12",
  rear: "80",
  fastestLap: "52.400",
  maxRpm: "15800",
  condition: "Dry",
  date: "2026-08-16",
  eventName: "Club Round 4",
  ...overrides,
});

describe("gearRatio", () => {
  it("divides rear by front, the way a kart's gearing is quoted", () => {
    expect(gearRatio("12", "80")).toBeCloseTo(6.6667, 4);
    expect(gearRatio("11", "82")).toBeCloseTo(7.4545, 4);
  });

  /** Both sprocket fields are free text, so none of these can be assumed away. */
  it("returns nothing rather than a number when a sprocket is unusable", () => {
    expect(gearRatio("", "80")).toBeNull();
    expect(gearRatio("12", "")).toBeNull();
    expect(gearRatio("   ", "80")).toBeNull();
    expect(gearRatio("12T", "80")).toBeNull();
    expect(gearRatio("abc", "80")).toBeNull();
  });

  /**
   * A zero front sprocket is the one that matters: Number("0") is finite, so a bare finite check
   * would divide by it and hand back Infinity for the UI to render.
   */
  it("refuses a zero or negative sprocket instead of dividing by it", () => {
    expect(gearRatio("0", "80")).toBeNull();
    expect(gearRatio("12", "0")).toBeNull();
    expect(gearRatio("-12", "80")).toBeNull();
  });

  it("accepts a count someone typed with a decimal point", () => {
    expect(gearRatio("12.0", "80")).toBeCloseTo(6.6667, 4);
  });
});

describe("formatRatio", () => {
  it("shows two decimals, which is how gearing is written down", () => {
    expect(formatRatio("12", "80")).toBe("6.67");
    expect(formatRatio("10", "80")).toBe("8.00");
  });

  it("shows a dash rather than NaN when the ratio is unknown", () => {
    expect(formatRatio("", "")).toBe("—");
    expect(formatRatio("0", "80")).toBe("—");
    expect(formatRatio("12T", "80")).toBe("—");
  });
});

describe("summariseGearing", () => {
  it("collapses Runs that shared a sprocket pair into one row", () => {
    const summary = summariseGearing([run(), run({ fastestLap: "52.100" }), run({ front: "13" })]);

    expect(summary).toHaveLength(2);
    expect(summary.find((row) => row.front === "12")?.runs).toBe(2);
    expect(summary.find((row) => row.front === "13")?.runs).toBe(1);
  });

  /** The pair is what gets fitted; 12/80 and 6/40 are the same gearing, not the same job. */
  it("keeps different sprockets apart even when the ratio is identical", () => {
    const summary = summariseGearing([run(), run({ front: "6", rear: "40" })]);

    expect(summary).toHaveLength(2);
    expect(summary.map((row) => row.ratio)).toEqual([summary[0].ratio, summary[0].ratio]);
  });

  it("takes the fastest lap and the highest RPM across the group", () => {
    const summary = summariseGearing([
      run({ fastestLap: "52.400", maxRpm: "15600" }),
      run({ fastestLap: "51.900", maxRpm: "15900" }),
    ]);

    expect(summary[0].bestLap).toBe("51.900");
    expect(summary[0].maxRpm).toBe("15900");
  });

  /** A lap typed "51.800" is written to three places deliberately; String(51.8) loses that. */
  it("reports the lap as it was typed rather than as the number it parses to", () => {
    expect(summariseGearing([run({ fastestLap: "51.800" })])[0].bestLap).toBe("51.800");
  });

  /**
   * Lap times are free text, so "1:02.5" is not a number. It is left out rather than poisoning the
   * best lap with NaN; that the app cannot read such a lap at all is a separate fault.
   */
  it("ignores a lap time it cannot read rather than reporting NaN", () => {
    const summary = summariseGearing([run({ fastestLap: "1:02.5" }), run({ fastestLap: "52.400" })]);

    expect(summary[0].bestLap).toBe("52.400");
  });

  it("leaves best lap and RPM blank when nothing usable was recorded", () => {
    const summary = summariseGearing([run({ fastestLap: "", maxRpm: "" })]);

    expect(summary[0].bestLap).toBe("");
    expect(summary[0].maxRpm).toBe("");
  });

  it("lists each condition once", () => {
    const summary = summariseGearing([run(), run({ condition: "Wet" }), run({ condition: "Dry" })]);

    expect(summary[0].conditions).toEqual(["Dry", "Wet"]);
  });

  it("reports when the gearing was last used, and at which Event", () => {
    const summary = summariseGearing([
      run({ date: "2026-05-02", eventName: "Spring test" }),
      run({ date: "2026-08-16", eventName: "Club Round 4" }),
    ]);

    expect(summary[0].lastUsed).toBe("2026-08-16");
    expect(summary[0].lastEvent).toBe("Club Round 4");
  });

  it("orders the most recently used gearing first", () => {
    const summary = summariseGearing([
      run({ front: "11", date: "2026-05-02" }),
      run({ front: "13", date: "2026-08-16" }),
      run({ front: "12", date: "2026-07-01" }),
    ]);

    expect(summary.map((row) => row.front)).toEqual(["13", "12", "11"]);
  });

  /** A Run with no sprockets answers no question, so it is not a row. */
  it("leaves out Runs with no usable gearing", () => {
    expect(summariseGearing([run({ front: "" }), run({ rear: "0" }), run({ front: "abc" })])).toEqual([]);
  });

  it("returns nothing for no Runs at all", () => {
    expect(summariseGearing([])).toEqual([]);
  });
});

describe("ratioChange", () => {
  /** One tooth on the rear is the commonest change made at a circuit. */
  it("calls more rear teeth shorter gearing", () => {
    const change = ratioChange({ front: "12", rear: "80" }, { front: "12", rear: "81" })!;
    expect(change.direction).toBe("shorter");
    expect(change.percent).toBeCloseTo(1.25, 2);
  });

  it("calls fewer rear teeth longer gearing", () => {
    const change = ratioChange({ front: "12", rear: "80" }, { front: "12", rear: "79" })!;
    expect(change.direction).toBe("longer");
    expect(change.percent).toBeCloseTo(-1.25, 2);
  });

  /** A tooth off the front shortens the gearing, which is the direction people get wrong. */
  it("calls fewer front teeth shorter gearing", () => {
    expect(ratioChange({ front: "12", rear: "80" }, { front: "11", rear: "80" })!.direction).toBe("shorter");
  });

  it("reports no change when the gearing is the same", () => {
    expect(ratioChange({ front: "12", rear: "80" }, { front: "12", rear: "80" })).toEqual({ percent: 0, direction: "same" });
  });

  /** Different sprockets, identical ratio: 12/80 and 6/40 both give 6.67. */
  it("reports no change when different sprockets give the same ratio", () => {
    expect(ratioChange({ front: "12", rear: "80" }, { front: "6", rear: "40" })!.direction).toBe("same");
  });

  it("returns nothing when either Run has no usable gearing", () => {
    expect(ratioChange({ front: "", rear: "80" }, { front: "12", rear: "80" })).toBeNull();
    expect(ratioChange({ front: "12", rear: "80" }, { front: "12", rear: "" })).toBeNull();
  });
});
