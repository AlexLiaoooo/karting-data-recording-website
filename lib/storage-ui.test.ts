import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import { LanguageProvider } from "./i18n";
import { emptyAppData, loadData, saveData } from "./database";
import { loadTrackMapData, restoreFullData, saveTrackMapData } from "./track-map/database";
import { buildFullBackup } from "./track-map/backup";
import { makeAppData, makeEvent, makeRun, makeSession } from "./test-fixtures";
import { createRun, type AppData, type RunRecord } from "./types";
import { BACKUP_HISTORY_KEY, ONE_DAY } from "./backup-reminder";
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
  vi.stubGlobal("URL", Object.assign(class extends URL {}, {
    createObjectURL: vi.fn(() => "blob:backup-test"), revokeObjectURL: vi.fn(),
  }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
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
  vi.restoreAllMocks();
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
  const match = [...container.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent?.trim() === label || element.getAttribute("aria-label") === label);
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

async function loadBackup() {
  await act(async () => button("Data and settings").click());
  await selectBackup();
}

async function selectBackup() {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const text = await buildFullBackup(makeAppData(), emptyTrackMapData());
  Object.defineProperty(input, "files", { configurable: true, value: [{ text: async () => text }] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

describe("save and restore recovery", () => {
  it("can restore a validated backup directly from a failed startup without enabling edits early", async () => {
    vi.mocked(loadData).mockRejectedValueOnce(new Error("Damaged saved records"));
    await render();
    expect(container.textContent).toContain("Your records could not be loaded");
    await selectBackup();
    expect(container.textContent).toContain("Replace current data?");
    expect(saveData).not.toHaveBeenCalled();
    await act(async () => button("Restore backup").click());
    expect(restoreFullData).toHaveBeenCalledWith(makeAppData(), emptyTrackMapData());
    expect(container.textContent).toContain("Backup restored");
    expect(container.textContent).not.toContain("Your records could not be loaded");
  });

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

describe("backup reminder controls", () => {
  it("offers a backup after records exist and stores a one-day dismissal", async () => {
    vi.mocked(loadData).mockResolvedValue(makeAppData());
    await render();
    expect(container.textContent).toContain("Keep a backup of your track days");
    const before = Date.now();
    await act(async () => button("Remind me tomorrow").click());
    expect(container.textContent).not.toContain("Keep a backup of your track days");
    const stored = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY)!);
    expect(stored.dismissedUntil).toBeGreaterThanOrEqual(before + ONE_DAY);
    expect(stored.lastExportAt).toBeNull();
  });

  it("records a full export, hides the reminder, and shows export history in settings", async () => {
    vi.mocked(loadData).mockResolvedValue(makeAppData());
    await render();
    await act(async () => button("Export full backup").click());
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(container.textContent).not.toContain("Keep a backup of your track days");
    expect(JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY)!).lastExportAt).toBeGreaterThan(0);
    await act(async () => button("Data and settings").click());
    expect(container.textContent).toContain("Last full backup export:");
  });

  it("leaves the reminder active and does not record an export when download preparation fails", async () => {
    vi.mocked(loadData).mockResolvedValue(makeAppData());
    vi.mocked(URL.createObjectURL).mockImplementationOnce(() => { throw new Error("Cannot create download"); });
    await render();
    await act(async () => button("Export full backup").click());
    expect(container.textContent).toContain("Backup could not be created");
    expect(container.textContent).toContain("Keep a backup of your track days");
    expect(localStorage.getItem(BACKUP_HISTORY_KEY)).toBeNull();
  });
});

function recordWith(run: RunRecord) {
  return makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs: [run] })] })] });
}

function inputNamed(name: string) {
  const element = [...container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")]
    .find((input) => input.getAttribute("aria-label") === name || input.closest("label")?.querySelector("span")?.textContent === name);
  if (!element) throw new Error(`Missing input: ${name}`);
  return element;
}

async function editInput(name: string, value: string) {
  const element = inputNamed(name);
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function openRecordedRun(data: AppData) {
  vi.mocked(loadData).mockResolvedValue(data);
  await render();
  await act(async () => button("Resume recording").click());
  const session = [...container.querySelectorAll<HTMLButtonElement>("button.list-item")].find((element) => element.textContent?.includes("Practice 1"))!;
  await act(async () => session.click());
  const run = [...container.querySelectorAll<HTMLButtonElement>("button.list-item")].find((element) => element.textContent?.includes("Run 01"))!;
  await act(async () => run.click());
}

describe("before/after Run recording", () => {
  it("offers a direct return shortcut for the latest unfinished Run while displaying each Run's phase", async () => {
    const before = createRun(2);
    const after = { ...createRun(3), recordingPhase: "after" as const };
    const completed = { ...createRun(4), completed: true };
    vi.mocked(loadData).mockResolvedValue(makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs: [before, after, completed] })] })] }));
    await render();
    await act(async () => button("Resume recording").click());
    await act(async () => container.querySelector<HTMLButtonElement>("button.list-item")!.click());
    const rows = [...container.querySelectorAll("button.list-item")].map((element) => element.textContent);
    expect(rows[0]).toContain("Completed");
    expect(rows[1]).toContain("After Run");
    expect(rows[2]).toContain("Before Run");
    await act(async () => button("Record hot readings · Run 03").click());
    expect(button("After Run").getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Run 03");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
    const runs = vi.mocked(saveData).mock.calls.at(-1)![0].events[0].sessions[0].runs;
    expect(runs[0].recordingPhase).toBe("before");
    expect(runs[1].recordingPhase).toBe("after");
    expect(runs[1].completed).toBe(false);
  });

  it("can return directly from preparation, and copying a finished Run starts a fresh preparation", async () => {
    await openRecordedRun(recordWith(createRun(1)));
    await act(async () => button("Back").click());
    await act(async () => button("Record hot readings · Run 01").click());
    expect(button("After Run").getAttribute("aria-pressed")).toBe("true");
    await editInput("Front left Hot pressure", "12.5");
    await act(async () => button("Complete Run 01").click());
    expect(container.textContent).not.toContain("Record hot readings");
    await act(async () => button("Duplicate last run").click());
    expect(button("Before Run").getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("After Run").click());
    expect(inputNamed("Front left Hot pressure").value).toBe("");
  });

  it("keeps preparation and results separate, preserves edits through switches, and saves the return phase", async () => {
    await openRecordedRun(recordWith(createRun(1)));
    expect(button("Before Run").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('input[aria-label="Front left Hot pressure"]')).toBeNull();
    expect(container.textContent).not.toContain("Driver feedback");
    await editInput("Front left Cold pressure", "10.5");
    await editInput("Front left Cold temp", "18");
    await editInput("Rear sprocket", "82");
    await act(async () => button("Record after Run").click());
    expect(document.activeElement).toBe(button("After Run"));
    expect(button("After Run").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('input[aria-label="Front left Cold pressure"]')).toBeNull();
    expect(container.textContent).toContain("Cold: 10.5 PSI");
    expect(container.textContent).not.toContain("Chassis setup");
    await editInput("Front left Hot pressure", "12.5");
    await editInput("Front left Hot temp", "48");
    await editInput("Fastest lap", "48.21");
    await editInput("General comments", "Better corner exit");
    expect(container.textContent).toContain("Gain: +2.0 PSI");
    await act(async () => button("Before Run").click());
    expect(inputNamed("Front left Cold pressure").value).toBe("10.5");
    expect(inputNamed("Rear sprocket").value).toBe("82");
    await act(async () => button("After Run").click());
    expect(inputNamed("Front left Hot pressure").value).toBe("12.5");
    expect(inputNamed("Fastest lap").value).toBe("48.21");
    expect(inputNamed("General comments").value).toBe("Better corner exit");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
    const run = vi.mocked(saveData).mock.calls.at(-1)![0].events[0].sessions[0].runs[0];
    expect(run.recordingPhase).toBe("after");
    expect(run.completed).toBe(false);
    expect(run.tyres.fl).toEqual({ coldPressure: "10.5", coldTemperature: "18", hotPressure: "12.5", hotTemperature: "48" });
  });

  it("reopens a saved return phase with blank results and permits completion without mandatory measurements", async () => {
    await openRecordedRun(recordWith({ ...createRun(1), recordingPhase: "after" }));
    expect(button("After Run").getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("Complete Run 01").click());
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
    const run = vi.mocked(saveData).mock.calls.at(-1)![0].events[0].sessions[0].runs[0];
    expect(run.completed).toBe(true);
    expect(run.recordingPhase).toBe("after");
    expect(run.tyres.fl.hotPressure).toBe("");
  });

  it("opens a completed legacy Run in results and can review its original cold/setup values", async () => {
    await openRecordedRun(recordWith(makeRun()));
    expect(button("After Run").getAttribute("aria-pressed")).toBe("true");
    expect(inputNamed("Front left Hot pressure").value).toBe("12.5");
    await act(async () => button("Review cold tyres & setup").click());
    expect(inputNamed("Front left Cold pressure").value).toBe("10.0");
    expect(inputNamed("Rear sprocket").value).toBe("82");
    expect(container.textContent).toContain("COMPLETED RUN");
  });
});
