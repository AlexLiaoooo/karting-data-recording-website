import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import { LanguageProvider } from "./i18n";
import { emptyAppData, loadData, saveData } from "./database";
import { loadTrackMapData, restoreFullData, saveTrackMapData } from "./track-map/database";
import { buildFullBackup } from "./track-map/backup";
import { makeAppData, makeEvent, makeRun, makeSession, makeTrackMapData, makeLayout, makeMarker, makeVisit } from "./test-fixtures";
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

async function chooseBaseline(value: string) {
  const select = [...container.querySelectorAll<HTMLSelectElement>("select")]
    .find(element => element.closest("label")?.querySelector("span")?.textContent === "Baseline Run")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const experimentNotes = { baselineRunId: "baseline", change: "Rear width +5mm", expectation: "Less understeer", outcome: "Better exit, more mid-corner sliding" };
function journalRecords() {
  return makeAppData({ events: [
    makeEvent({ name: "Baseline day", sessions: [makeSession({ runs: [makeRun({ id: "baseline", fastestLap: "49.00" })] })] }),
    makeEvent({ id: "test-event", name: "Test day", track: "Whilton Mill", sessions: [makeSession({
      id: "test-session", condition: "Wet", trackTemperature: "14", runs: [makeRun({ id: "test", fastestLap: "48.21", experiment: experimentNotes })],
    })] }),
  ] });
}

describe("setup experiment journal", () => {
  it("shows an empty journal without inventing experiments on existing Runs", async () => {
    vi.mocked(loadData).mockResolvedValue(makeAppData());
    await render();
    await act(async () => button("Setup experiment journalChanges, expectations and outcomes across your Runs").click());
    expect(container.textContent).toContain("No setup experiments yet");
  });

  it("preserves baseline and preparation notes across phases, saves the outcome, and excludes self from baseline choices", async () => {
    const test = { ...createRun(1), id: "test" };
    const data = recordWith(test);
    data.events.push(makeEvent({ id: "other-event", name: "Baseline day", sessions: [makeSession({ id: "other-session", runs: [makeRun({ id: "baseline", fastestLap: "49.00" })] })] }));
    await openRecordedRun(data);
    expect(container.querySelector('select option[value="test"]')).toBeNull();
    await chooseBaseline("baseline");
    await editInput("What I changed", experimentNotes.change);
    await editInput("What I expected", experimentNotes.expectation);
    expect(container.textContent).not.toContain("What happened");
    await act(async () => button("After Run").click());
    expect(inputNamed("What I changed").value).toBe(experimentNotes.change);
    await editInput("What happened", experimentNotes.outcome);
    await editInput("Fastest lap", "48.21");
    expect(container.textContent).toContain("0.790 s faster than baseline");
    await act(async () => button("Compare linked Runs").click());
    expect(container.querySelectorAll(".compare-head small")[0]?.textContent).toContain("Baseline day");
    await act(async () => button("Back").click());
    expect(inputNamed("What happened").value).toBe(experimentNotes.outcome);
    await act(async () => button("Before Run").click());
    expect(inputNamed("What I expected").value).toBe(experimentNotes.expectation);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
    const saved = vi.mocked(saveData).mock.calls.at(-1)![0].events[0].sessions[0].runs[0];
    expect(saved.experiment).toEqual(experimentNotes);
    expect(saved.completed).toBe(false);
    await chooseBaseline("");
    expect(inputNamed("What I changed").value).toBe(experimentNotes.change);
    expect(container.textContent).not.toContain("Compare linked Runs");
  });

  it("shows cross-Event conditions, searches notes, opens both Runs, and returns comparison to the journal", async () => {
    vi.mocked(loadData).mockResolvedValue(journalRecords());
    await render();
    await act(async () => button("Setup experiment journalChanges, expectations and outcomes across your Runs").click());
    expect(container.textContent).toContain("0.790 s faster than baseline");
    expect(container.textContent).toContain("Not like for like: Dry against Wet");
    expect(container.textContent).toContain("Different circuits or layouts");
    expect(container.textContent).toContain("14 °C");
    await editInput("Search experiments", "no matching notes");
    expect(container.textContent).toContain("No experiments match your search");
    await editInput("Search experiments", "mid-corner");
    expect(container.textContent).toContain(experimentNotes.outcome);
    await act(async () => button("Compare linked Runs").click());
    expect(container.querySelector('[role="table"][aria-label="Run comparison"]')).not.toBeNull();
    await act(async () => button("Back").click());
    expect(container.querySelector(".experiment-journal")).not.toBeNull();
    await act(async () => button("Open baseline Run").click());
    expect(container.querySelector('[aria-label="Test Run"]')?.textContent).toContain("Baseline day");
    expect(inputNamed("Fastest lap").value).toBe("49.00");
    await act(async () => button("Back").click());
    await act(async () => button("Open test Run").click());
    expect(inputNamed("What happened").value).toBe(experimentNotes.outcome);
    await editInput("What happened", "Updated result");
    await act(async () => button("Back").click());
    expect(container.textContent).toContain("Updated result");
  });

  it("retains orphaned notes, permits a replacement baseline, and keeps completed Runs editable", async () => {
    const records = journalRecords();
    records.events[1].sessions[0].runs[0].experiment!.baselineRunId = "deleted-run";
    vi.mocked(loadData).mockResolvedValue(records);
    await render();
    await act(async () => button("Setup experiment journalChanges, expectations and outcomes across your Runs").click());
    expect(container.textContent).toContain("Baseline Run is unavailable");
    expect(container.textContent).toContain(experimentNotes.outcome);
    expect(container.textContent).not.toContain("Compare linked Runs");
    await act(async () => button("Open test Run").click());
    await chooseBaseline("baseline");
    expect(container.textContent).toContain("Compare linked Runs");
    expect(inputNamed("What happened").value).toBe(experimentNotes.outcome);
    expect(container.textContent).toContain("COMPLETED RUN");
  });
});

async function openTimeline(data: AppData) {
  vi.mocked(loadData).mockResolvedValue(data);
  await render();
  await act(async () => button("Resume recording").click());
  const session = [...container.querySelectorAll<HTMLButtonElement>("button.list-item")]
    .find(element => element.textContent?.includes("Practice 1"))!;
  await act(async () => session.click());
  await act(async () => button("Session timeline & charts").click());
}

function briefingRecords() {
  const wetRun = makeRun({ id: "wet-run", number: 2, completed: false, recordingPhase: "after", comments: "Wet setup comments" });
  wetRun.setup.rearSprocket = "84";
  wetRun.setup.axleType = "Soft";
  wetRun.tyres.fl.hotPressure = "11.0";
  const past = makeEvent({ id: "past", name: "Previous test", trackLayoutId: "layout-1", notes: "Previous Event notes", sessions: [
    makeSession({ id: "dry-session", notes: "Dry Session notes" }),
    makeSession({ id: "wet-session", name: "Wet practice", condition: "Wet", trackTemperature: "14", runs: [wetRun, createRun(3)] }),
  ] });
  const current = makeEvent({ id: "current", name: "Return visit", trackLayoutId: "layout-1", startDate: "2026-10-11", sessions: [makeSession({ condition: "Wet", trackTemperature: "15" })] });
  const maps = makeTrackMapData({ layouts: [makeLayout({ markers: [makeMarker({ label: "", cornerNumber: 1, dryNote: "Dry apex note", wetNote: "Wet outside line" })], corners: [{ number: 1, label: "Hairpin", x: 0.4, y: 0.6 }] })], visits: [makeVisit({ eventId: "past", sessionId: "wet-session", condition: "Wet", summary: "Previous wet visit summary" })] });
  return { data: makeAppData({ events: [current, past], lastEventId: "current" }), maps };
}

describe("returning-to-track briefing screens", () => {
  it("opens from an Event, separates condition histories and resolves current corner labels without changing records", async () => {
    const { data, maps } = briefingRecords();
    const snapshot = JSON.stringify({ data, maps });
    vi.mocked(loadData).mockResolvedValue(data);
    vi.mocked(loadTrackMapData).mockResolvedValue(maps);
    await render();
    await act(async () => button("Resume recording").click());
    await act(async () => button("Returning-to-track briefing").click());
    const lastVisit = container.querySelector('[aria-labelledby="briefing-last-visit"]')!;
    expect(lastVisit.textContent).toContain("Previous test");
    expect(lastVisit.textContent).toContain("Run 02");
    expect(lastVisit.textContent).toContain("After Run");
    expect(lastVisit.textContent).toContain("Soft");
    expect(lastVisit.textContent).toContain("Previous wet visit summary");
    expect(lastVisit.textContent).toContain("Previous Event notes");
    const reference = container.querySelector('[aria-labelledby="briefing-reference-notes"]')!;
    expect(reference.textContent).toContain("Hairpin");
    expect(reference.textContent).toContain("Dry apex note");
    expect(reference.textContent).not.toContain("Wet outside line");
    const gearing = container.querySelector('[aria-labelledby="briefing-gearing"]')!;
    const pressure = container.querySelector('[aria-labelledby="briefing-pressure"]')!;
    expect(gearing.textContent).toContain("11/82");
    expect(gearing.textContent).not.toContain("11/84");
    expect(pressure.textContent).toContain("front +2.5 psi");
    await act(async () => button("Wet").click());
    expect(gearing.textContent).toContain("11/84");
    expect(gearing.textContent).not.toContain("11/82");
    expect(pressure.textContent).toContain("front +1.0 psi");
    expect(reference.textContent).toContain("Wet outside line");
    expect(reference.textContent).not.toContain("Dry apex note");
    await act(async () => button("Damp").click());
    expect(reference.textContent).toContain("Dry apex note");
    expect(reference.textContent).toContain("Wet outside line");
    expect(gearing.querySelector("table")).toBeNull();
    expect(pressure.querySelector("table")).toBeNull();
    expect(JSON.stringify({ data, maps })).toBe(snapshot);
    await act(async () => button("Back").click());
    expect(container.textContent).toContain("EVENT CONDITIONS");
  });

  it("starts with a Session override and returns to that Session", async () => {
    const { data, maps } = briefingRecords();
    vi.mocked(loadData).mockResolvedValue(data);
    vi.mocked(loadTrackMapData).mockResolvedValue(maps);
    await render();
    await act(async () => button("Resume recording").click());
    await act(async () => container.querySelector<HTMLButtonElement>("button.list-item")!.click());
    await act(async () => button("Returning-to-track briefing").click());
    expect(button("Wet").getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Closest recorded track temperature: 14 °C");
    await act(async () => button("Back").click());
    expect(container.textContent).toContain("SESSION SUMMARY");
    await act(async () => button("Back").click());
    await act(async () => button("Returning-to-track briefing").click());
    expect(button("Dry").getAttribute("aria-pressed")).toBe("true");
  });

  it("explains unlinked Events and allows return to edit the Event", async () => {
    vi.mocked(loadData).mockResolvedValue(makeAppData());
    await render();
    await act(async () => button("Resume recording").click());
    await act(async () => button("Returning-to-track briefing").click());
    expect(container.textContent).toContain("Edit this Event and choose a saved Track Layout");
    await act(async () => button("Back").click());
    expect(button("Edit event").disabled).toBe(false);
  });

  it("shows reference notes on a first visit and handles an unavailable saved Layout", async () => {
    const { data, maps } = briefingRecords();
    data.events = [data.events[0]];
    vi.mocked(loadData).mockResolvedValue(data);
    vi.mocked(loadTrackMapData).mockResolvedValue(maps);
    await render();
    await act(async () => button("Resume recording").click());
    await act(async () => button("Returning-to-track briefing").click());
    expect(container.textContent).toContain("No earlier visit recorded for this Layout yet");
    expect(container.textContent).toContain("Dry apex note");
    await act(async () => root.unmount());
    root = createRoot(container);
    vi.mocked(loadTrackMapData).mockResolvedValue(emptyTrackMapData());
    await render();
    await act(async () => button("Resume recording").click());
    await act(async () => button("Returning-to-track briefing").click());
    expect(container.textContent).toContain("This Event's saved Layout is unavailable");
  });
});

function timelineRecords() {
  const baseline = makeRun({ number: 1, fastestLap: "1:02.500", averageLap: "63.0" });
  baseline.tyres.fl.coldTemperature = "0";
  const gap = { ...createRun(4), id: "gap" };
  const test = makeRun({ id: "test", number: 7, fastestLap: "1:01.500", averageLap: "61.8", completed: false, recordingPhase: "after", comments: "More stable exit" });
  test.tyres.fl.coldPressure = "10.5";
  test.tyres.fl.coldTemperature = "-2";
  test.tyres.fl.hotTemperature = "44";
  test.setup.rearSprocket = "84";
  return makeAppData({ events: [makeEvent({ sessions: [makeSession({ condition: "Wet", trackTemperature: "14", runs: [baseline, gap, test] })] })] });
}

describe("Session timeline and charts", () => {
  it("opens an empty Session timeline and returns safely to recording", async () => {
    await openTimeline(makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs: [] })] })] }));
    expect(container.textContent).toContain("No Runs to show yet");
    expect(container.querySelector(".timeline-chart")).toBeNull();
    await act(async () => button("Back").click());
    expect(button("Add blank Run 01")).toBeDefined();
  });

  it("shows unknown readings without plotting zeros, including a single blank Run", async () => {
    await openTimeline(recordWith(createRun(1)));
    expect(container.textContent).toContain("No usable readings for this chart yet");
    expect(container.querySelector(".timeline-chart")).toBeNull();
    const row = container.querySelector(".timeline-values tbody tr")!;
    expect([...row.querySelectorAll("td")].map(cell => cell.textContent)).toEqual(["—", "—"]);
    expect(container.querySelectorAll(".timeline-run-card")).toHaveLength(1);
    expect(container.textContent).toContain("First recorded Run in this Session");
  });

  it("displays Session context, ordered Run numbers, and chart gaps with usable minute lap times", async () => {
    const records = timelineRecords();
    records.events[0].sessions[0].runs.reverse();
    await openTimeline(records);
    expect(container.textContent).toContain("Wet");
    expect(container.textContent).toContain("14 °C");
    expect([...container.querySelectorAll(".timeline-run-card h3")].map(heading => heading.textContent)).toEqual(["Run 01", "Run 04", "Run 07"]);
    expect(container.querySelectorAll(".timeline-chart circle")).toHaveLength(4);
    expect(container.querySelectorAll(".timeline-chart polyline")).toHaveLength(0);
    const rows = [...container.querySelectorAll(".timeline-values tbody tr")];
    expect(rows[0].textContent).toContain("1:02.500");
    expect([...rows[1].querySelectorAll("td")].map(cell => cell.textContent)).toEqual(["—", "—"]);
    expect(container.querySelectorAll(".timeline-run-card")[2].textContent).toContain("since Run 04");
    expect(container.querySelectorAll(".timeline-run-card")[2].textContent).toContain("Rear sprocket");
    expect(container.querySelectorAll(".timeline-run-card")[2].textContent).toContain("— → 84");
    expect(container.textContent).toContain("More stable exit");
  });

  it("switches pressure/temperature/gearing readings and preserves the selected view through edits and comparison", async () => {
    await openTimeline(timelineRecords());
    await act(async () => button("Pressure gains").click());
    expect(container.querySelector(".timeline-values tbody tr")!.textContent).toContain("+2.5");
    await act(async () => button("Tyre temperatures").click());
    expect(container.querySelector(".timeline-values tbody tr")!.textContent).toContain("48");
    await act(async () => button("Cold tyres").click());
    const first = container.querySelector(".timeline-values tbody tr")!;
    expect(first.querySelector("td")!.textContent).toBe("0");
    const last = [...container.querySelectorAll(".timeline-values tbody tr")].at(-1)!;
    expect(last.querySelector("td")!.textContent).toBe("-2");
    await act(async () => button("Open Run 07").click());
    await editInput("Fastest lap", "1:00.500");
    await act(async () => button("Back").click());
    expect(button("Tyre temperatures").getAttribute("aria-pressed")).toBe("true");
    expect(button("Cold tyres").getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("Lap times").click());
    expect([...container.querySelectorAll(".timeline-values tbody tr")].at(-1)!.textContent).toContain("1:00.500");
    await act(async () => button("Gearing").click());
    expect([...container.querySelectorAll(".timeline-values tbody tr")].at(-1)!.textContent).toContain("7.64");
    await act(async () => button("Compare with Run 04").click());
    expect([...container.querySelectorAll(".compare-head > strong")].map(heading => heading.firstChild?.textContent)).toEqual(["Run 04", "Run 07"]);
    await act(async () => button("Back").click());
    expect(button("Gearing").getAttribute("aria-pressed")).toBe("true");
    await act(async () => button("Open Run 07").click());
    await act(async () => button("Complete Run 07").click());
    expect(container.querySelector(".session-timeline")).not.toBeNull();
    expect(container.querySelectorAll(".timeline-run-card")[2].textContent).toContain("Completed");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)); });
    const saved = vi.mocked(saveData).mock.calls.at(-1)![0].events[0].sessions[0].runs[2];
    expect(saved.fastestLap).toBe("1:00.500");
    expect(saved.completed).toBe(true);
  });

  it("keeps a long timeline scoped to this Session and exposes every Run's values and actions", async () => {
    const runs = Array.from({ length: 24 }, (_, index) => makeRun({ id: `run-${index}`, number: index + 1, fastestLap: String(49 + index / 100) }));
    const data = makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs }), makeSession({ id: "other-session", name: "Qualifying", runs: [makeRun({ id: "other", number: 99 })] })] })] });
    await openTimeline(data);
    expect(container.querySelectorAll(".timeline-run-card")).toHaveLength(24);
    expect(container.querySelectorAll(".timeline-values tbody tr")).toHaveLength(24);
    expect(container.textContent).not.toContain("Run 99");
    expect(button("Open Run 24")).toBeDefined();
    expect([...container.querySelectorAll(".timeline-chart circle title")].some(title => title.textContent?.includes("Run 24"))).toBe(true);
  });
});
