import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("optional preference storage", () => {
  it("reads saved choices and persists changes when storage is available", async () => {
    const { readPreference, writePreference } = await import("./preferences");
    localStorage.setItem("kart-data-language", "zh");
    expect(readPreference("kart-data-language")).toBe("zh");
    writePreference("kart-data-language", "en");
    expect(localStorage.getItem("kart-data-language")).toBe("en");
  });
  it("returns no stored preference when reads are denied", async () => {
    const { readPreference } = await import("./preferences");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    expect(readPreference("kart-data-language")).toBeNull();
    expect(readPreference("kart-data-theme")).toBeNull();
  });
  it("keeps a new session choice even when the old stored preference cannot be replaced", async () => {
    const { readPreference, writePreference } = await import("./preferences");
    localStorage.setItem("kart-data-theme", "light");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(() => writePreference("kart-data-theme", "dark")).not.toThrow();
    expect(readPreference("kart-data-theme")).toBe("dark");
    expect(localStorage.getItem("kart-data-theme")).toBe("light");
  });
  it("works with an unavailable localStorage API", async () => {
    const { readPreference, writePreference } = await import("./preferences");
    vi.stubGlobal("localStorage", undefined);
    expect(readPreference("kart-data-language")).toBeNull();
    writePreference("kart-data-language", "zh");
    expect(readPreference("kart-data-language")).toBe("zh");
  });
});
