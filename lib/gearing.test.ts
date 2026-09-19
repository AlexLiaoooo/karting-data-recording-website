import { describe, expect, it } from "vitest";
import { formatRatio, gearRatio, ratioChange } from "./gearing";

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
