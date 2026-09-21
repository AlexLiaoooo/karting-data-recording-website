import { describe, expect, it } from "vitest";
import { formatLapTime, parseLapTime } from "./lap-time";

describe("parseLapTime", () => {
  it("reads plain seconds, which is how a kart lap is usually written", () => {
    expect(parseLapTime("52.400")).toBeCloseTo(52.4, 4);
    expect(parseLapTime("48")).toBe(48);
  });

  /** The fault: Number("1:02.5") is NaN, so such a lap vanished from every computed figure. */
  it("reads a lap over a minute written as m:ss", () => {
    expect(parseLapTime("1:02.5")).toBeCloseTo(62.5, 4);
    expect(parseLapTime("1:02.500")).toBeCloseTo(62.5, 4);
    expect(parseLapTime("1:00")).toBe(60);
    expect(parseLapTime("2:07.891")).toBeCloseTo(127.891, 4);
  });

  it("reads a lap over a minute written as plain seconds too", () => {
    expect(parseLapTime("62.5")).toBeCloseTo(62.5, 4);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseLapTime("  52.400 ")).toBeCloseTo(52.4, 4);
    expect(parseLapTime(" 1:02.5 ")).toBeCloseTo(62.5, 4);
  });

  it("rejects text that is not a lap time", () => {
    for (const value of ["", "   ", "abc", "1:2:3", "52s", "-52.4", "0", "1:"]) {
      expect(parseLapTime(value), value).toBeNull();
    }
  });

  /**
   * Sixty-one seconds past the minute is a mistyped clock reading, not a lap. Accepting it would
   * make "1:75" mean 2:15, which is not what anyone meant to type.
   */
  it("rejects a seconds part of sixty or more in the clock notation", () => {
    expect(parseLapTime("1:60")).toBeNull();
    expect(parseLapTime("1:75.2")).toBeNull();
  });
});

describe("formatLapTime", () => {
  it("writes a sub-minute lap as plain seconds", () => {
    expect(formatLapTime(52.4)).toBe("52.400");
    expect(formatLapTime(59.999)).toBe("59.999");
  });

  it("writes a lap of a minute or more the way a timing screen does", () => {
    expect(formatLapTime(60)).toBe("1:00.000");
    expect(formatLapTime(62.5)).toBe("1:02.500");
    expect(formatLapTime(127.891)).toBe("2:07.891");
  });

  /** The seconds part is zero-padded, or 1:02.5 would be written 1:2.500. */
  it("pads the seconds so the clock notation reads correctly", () => {
    expect(formatLapTime(61.25)).toBe("1:01.250");
    expect(formatLapTime(69.9)).toBe("1:09.900");
    expect(formatLapTime(70.1)).toBe("1:10.100");
  });

  it("gives nothing back for a value that is not a lap", () => {
    expect(formatLapTime(0)).toBe("");
    expect(formatLapTime(Number.NaN)).toBe("");
  });

  it("round-trips a lap through parse and format", () => {
    for (const value of ["52.400", "1:02.500", "2:07.891"]) {
      expect(formatLapTime(parseLapTime(value)!)).toBe(value);
    }
  });
});
