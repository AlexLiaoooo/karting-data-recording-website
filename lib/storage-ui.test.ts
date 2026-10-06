import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import { LanguageProvider } from "./i18n";
import { emptyAppData, loadData, saveData } from "./database";
import { loadTrackMapData, restoreFullData, saveTrackMapData } from "./track-map/database";
import { buildFullBackup } from "./track-map/backup";
import { makeAppData } from "./test-fixtures";
import { emptyTrackMapData } from "./track-map/types";

vi.mock("./database", async (original) => ({ ...await original<typeof import("./database")>(), loadData: vi.fn(), saveData: vi.fn() }));
vi.mock("./track-map/database", async (original) => ({ ...await original<typeof import("./track-map/database")>(), loadTrackMapData: vi.fn(), saveTrackMapData: vi.fn(), restoreFullData: vi.fn() }));
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
  vi.mocked(restoreFullData).mockResolvedValue();
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

function button(label: string) {
  const match = [...container.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent === label || element.getAttribute("aria-label") === label);
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

async function loadBackup() {
  await act(async () => button("Data and settings").click());
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const text = await buildFullBackup(makeAppData(), emptyTrackMapData());
  Object.defineProperty(input, "files", { configurable: true, value: [{ text: async () => text }] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

describe("save and restore recovery", () => {
  it("shows a failed save on the home and settings screens, and retries both current snapshots", async () => {
    vi.mocked(saveData).mockRejectedValueOnce(new Error("Quota exceeded"));
    await render();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
    expect(container.textContent).toContain("Changes could not be saved");
    await act(async () => button("Data and settings").click());
    expect(container.textContent).toContain("Keep this app open.");
    await act(async () => button("Retry saving").click());
    expect(saveData).toHaveBeenCalledTimes(2);
    expect(saveTrackMapData).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Changes could not be saved");
  });

  it("keeps the old screen until restore has committed and discards pending old debounces", async () => {
    let finish!: () => void;
    vi.mocked(restoreFullData).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    await render();
    await loadBackup();
    await act(async () => button("Restore backup").click());
    expect(button("Restoring…").disabled).toBe(true);
    expect(button("Cancel").disabled).toBe(true);
    expect(container.textContent).not.toContain("Backup restored");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
    expect(saveData).not.toHaveBeenCalled();
    expect(saveTrackMapData).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(container.textContent).toContain("Backup restored");
    expect(container.textContent).not.toContain("Replace current data?");
  });

  it("preserves current memory and offers recovery when an atomic restore fails", async () => {
    vi.mocked(restoreFullData).mockRejectedValueOnce(new Error("Quota exceeded"));
    await render();
    await loadBackup();
    await act(async () => button("Restore backup").click());
    expect(container.textContent).toContain("Your saved data was not replaced");
    expect(container.textContent).not.toContain("Backup restored");
    await act(async () => button("Cancel").click());
    await act(async () => button("Retry saving").click());
    expect(saveData).toHaveBeenLastCalledWith(emptyAppData());
  });
});
