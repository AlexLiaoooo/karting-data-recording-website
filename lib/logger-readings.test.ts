import { describe, expect, it } from "vitest";
import { suggestLoggerReadings, validLoggerReading } from "./logger-readings";
describe("labelled logger reading suggestions", () => {
  it("reads labelled fastest lap, completed laps and thousands-separated peak RPM", () => {
    expect(suggestLoggerReadings("BEST LAP 48.321 s\nLAPS 12\nMAX RPM 15,800")).toEqual({ values: { fastestLap: "48.321", laps: "12", maxRpm: "15800" }, conflicts: [] });
  });
  it("supports labels on a separate line, minute laps and decimal commas", () => {
    expect(suggestLoggerReadings("FASTEST LAP\n1:02,500\nLAP COUNT\n0\nPEAK RPM\n15 900").values).toEqual({ fastestLap: "1:02.500", laps: "0", maxRpm: "15900" });
  });
  it("refuses guesses from unlabeled numbers, average laps, minimum RPM and unknown glyphs", () => {
    const result = suggestLoggerReadings("48.321 12 15800\nAVG LAP TIME 48.600\nLAST LAP TIME 48.500\nMIN RPM 3000\nBEST LAP 4B.321\nLAPS 1O");
    expect(result.values).toEqual({ fastestLap: "", laps: "", maxRpm: "" });
  });
  it("keeps conflicting fields blank and treats duplicate equivalent readings as one", () => {
    const result = suggestLoggerReadings("BEST LAP 62.5\nFASTEST LAP 1:02.500\nLAPS 12\nLAPS 14\nMAX RPM 15800\nMAX RPM 15900");
    expect(result).toEqual({ values: { fastestLap: "1:02.500", laps: "", maxRpm: "" }, conflicts: ["laps", "maxRpm"] });
  });
  it("requires valid positive lap times, whole lap counts and positive whole RPM", () => {
    expect(suggestLoggerReadings("BEST LAP 1:70.500\nLAPS 12.5\nMAX RPM 0").values).toEqual({ fastestLap: "", laps: "", maxRpm: "" });
    expect(validLoggerReading("laps", "0")).toBe(true); expect(validLoggerReading("maxRpm", "0")).toBe(false);
    expect(validLoggerReading("maxRpm", "1e4")).toBe(false); expect(validLoggerReading("fastestLap", "1:02.500")).toBe(true);
  });
});
