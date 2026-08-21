import { describe, expect, it } from "vitest";
import { counted } from "./format";

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
