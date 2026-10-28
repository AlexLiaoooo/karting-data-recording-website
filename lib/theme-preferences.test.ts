import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import { FeatureHeader } from "../components/track-map/shared";
import { LanguageProvider } from "./i18n";

vi.mock("./database", async original => { const actual = await original<typeof import("./database")>(); return { ...actual, loadData: async () => actual.emptyAppData(), saveData: async () => {} }; });
vi.mock("./track-map/database", async original => ({ ...await original<typeof import("./track-map/database")>(), loadTrackMapData: async () => ({ version: 1, tracks: [], layouts: [], visits: [], assets: [] }), saveTrackMapData: async () => {}, restoreFullData: async () => {} }));
vi.mock("./track-map/built-in-maps", () => ({ refreshBuiltInMaps: async (data: unknown) => data }));
vi.mock("./writer-session", () => ({ claimWriter: async () => true, renewWriter: async () => {}, releaseWriter: async () => {} }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("theme without preference storage", () => {
  it("loads the app, keeps manual choices on system changes, and shares them with map controls", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let systemChanged = () => {};
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: (_name: string, listener: () => void) => { systemChanged = listener; }, removeEventListener() {} }));
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    const container = document.createElement("div"); document.body.appendChild(container); const root = createRoot(container);
    const toggle = () => container.querySelector<HTMLButtonElement>('button[aria-label="Switch light or dark mode"]')!;
    try {
      await act(async () => root.render(createElement(LanguageProvider, null, createElement(HomePage))));
      expect(container.textContent).toContain("Start your first event");
      expect(document.documentElement.dataset.theme).toBe("dark");
      await act(async () => toggle().click());
      expect(document.documentElement.dataset.theme).toBe("light");
      await act(async () => systemChanged());
      expect(document.documentElement.dataset.theme).toBe("light");
      await act(async () => root.render(createElement(LanguageProvider, null, createElement(FeatureHeader, { title: "Maps", onBack() {} }))));
      await act(async () => toggle().click());
      expect(document.documentElement.dataset.theme).toBe("dark");
      await act(async () => root.render(createElement(LanguageProvider, null, createElement(HomePage))));
      expect(document.documentElement.dataset.theme).toBe("dark");
    } finally { await act(async () => root.unmount()); container.remove(); }
  });
});
