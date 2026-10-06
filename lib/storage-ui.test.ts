import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import { LanguageProvider } from "./i18n";
import { emptyAppData, loadData, saveData } from "./database";
import { loadTrackMapData, saveTrackMapData } from "./track-map/database";
import { emptyTrackMapData } from "./track-map/types";

vi.mock("./database", async (original) => ({ ...await original<typeof import("./database")>(), loadData: vi.fn(), saveData: vi.fn() }));
vi.mock("./track-map/database", async (original) => ({ ...await original<typeof import("./track-map/database")>(), loadTrackMapData: vi.fn(), saveTrackMapData: vi.fn() }));
vi.mock("./track-map/built-in-maps", () => ({ refreshBuiltInMaps: vi.fn((data) => Promise.resolve(data)) }));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.mocked(loadData).mockResolvedValue(emptyAppData());
  vi.mocked(loadTrackMapData).mockResolvedValue(emptyTrackMapData());
  vi.mocked(saveData).mockResolvedValue();
  vi.mocked(saveTrackMapData).mockResolvedValue();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () => root.render(createElement(LanguageProvider, null, createElement(HomePage))));
}

describe("startup recovery", () => {
  it.each(["app", "maps"])("blocks edits and autosaving when the %s read fails, then supports retry", async (kind) => {
    const loader = kind === "app" ? loadData : loadTrackMapData;
    vi.mocked(loader).mockRejectedValueOnce(new Error("Storage read failed"));
    await render();
    expect(container.textContent).toContain("Your records could not be loaded");
    expect(container.textContent).not.toContain("Start your first event");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
    expect(saveData).not.toHaveBeenCalled();
    expect(saveTrackMapData).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(container.textContent).toContain("Start your first event");
  });
});
