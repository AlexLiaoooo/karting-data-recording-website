import { describe, expect, it } from "vitest";
import { counted, localDate } from "./format";

describe("localDate", () => {
  it("uses the device calendar at either end of the day", () => {
    expect(localDate(new Date(2026, 9, 4, 0, 15))).toBe("2026-10-04");
    expect(localDate(new Date(2026, 9, 4, 23, 45))).toBe("2026-10-04");
    expect(localDate(new Date(2026, 0, 2))).toBe("2026-01-02");
  });
});

describe("counted", () => {
  it("keeps the noun singular for one, which is what read wrong before", () => {
    expect(counted(1, "layout")).toBe("1 layout");
    expect(counted(1, "marker")).toBe("1 marker");
  });

  it("pluralises everything else, zero included", () => {
    expect(counted(0, "layout")).toBe("0 layouts");
    expect(counted(2, "layout")).toBe("2 layouts");
    expect(counted(11, "marker")).toBe("11 markers");
  });

  it("takes an explicit plural for a noun that does not just add an s", () => {
    expect(counted(1, "Session overlay", "Session overlays")).toBe("1 Session overlay");
    expect(counted(3, "Session overlay", "Session overlays")).toBe("3 Session overlays");
  });

  it("handles a multi-word noun, which is where the default matters", () => {
    expect(counted(1, "map image")).toBe("1 map image");
    expect(counted(4, "map image")).toBe("4 map images");
  });
});
