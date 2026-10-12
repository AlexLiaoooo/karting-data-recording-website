import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriverDebriefPanel } from "../components/driver-debrief";
import { LanguageProvider } from "./i18n";
import { makeRun } from "./test-fixtures";
import type { DriverDebrief } from "./types";

const mock = vi.hoisted(() => ({
  supported: true,
  callbacks: null as null | { state: (state: "idle" | "requesting" | "recording" | "processing") => void; elapsed: (time: number) => void; complete: (note: DriverDebrief) => void; error: (error: "permission") => void },
  start: vi.fn(), stop: vi.fn(), cancel: vi.fn(), dispose: vi.fn(),
}));
vi.mock("./driver-recorder", () => ({
  canRecordDebrief: () => mock.supported,
  DriverRecorder: class {
    constructor(callbacks: NonNullable<typeof mock.callbacks>) { mock.callbacks = callbacks; }
    start = mock.start; stop = mock.stop; cancel = mock.cancel; dispose = mock.dispose;
  },
}));
const note: DriverDebrief = { recordedAt: "2026-10-12T09:00:00.000Z", durationMs: 4500, mimeType: "audio/mp4", size: 4, dataUrl: "data:audio/mp4;base64,AQIDBA==" };
let root: Root; let container: HTMLDivElement;
const change = vi.fn(); const busy = vi.fn();
function Harness({ initial }: { initial?: DriverDebrief }) {
  const [run, setRun] = useState(() => makeRun({ driverDebrief: initial }));
  return createElement(DriverDebriefPanel, { run, onBusyChange: busy, onChange: next => { change(next); setRun(current => ({ ...current, driverDebrief: next })); } });
}
async function render(initial?: DriverDebrief) { await act(async () => root.render(createElement(LanguageProvider, null, createElement(Harness, { initial })))); }
async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(button => button.textContent === label);
  if (!button) throw new Error(`Missing button ${label}`);
  await act(async () => button.click());
}
async function draft() {
  await act(async () => { mock.callbacks!.state("idle"); mock.callbacks!.complete(note); });
}
beforeEach(() => {
  vi.clearAllMocks(); mock.supported = true;
  mock.start.mockImplementation(() => mock.callbacks!.state("recording"));
  mock.stop.mockImplementation(() => { mock.callbacks!.state("idle"); mock.callbacks!.complete(note); });
  mock.cancel.mockImplementation(() => mock.callbacks!.state("idle"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("driver debrief recording screen", () => {
  it("starts only on request and reviews the draft before attaching it to the Run", async () => {
    await render(); expect(mock.start).not.toHaveBeenCalled();
    await click("Record audio note"); expect(busy).toHaveBeenLastCalledWith(true);
    await act(async () => mock.callbacks!.elapsed(7000)); expect(container.textContent).toContain("Recording 0:07");
    await click("Stop recording");
    expect(container.textContent).toContain("This recording is not saved"); expect(change).not.toHaveBeenCalled();
    expect(container.querySelector("audio")!.src).toBe(note.dataUrl);
    const beforeUnload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(beforeUnload); expect(beforeUnload.defaultPrevented).toBe(true);
    await click("Save audio note"); expect(change).toHaveBeenCalledWith(note); expect(busy).toHaveBeenLastCalledWith(false);
    expect(container.textContent).toContain("Saved audio note"); expect(container.textContent).not.toContain("Review new recording");
  });
  it("keeps the original note when replacement recording is discarded", async () => {
    const original = { ...note, recordedAt: "2026-10-12T08:00:00.000Z" };
    await render(original); await click("Record replacement note"); await draft();
    expect(container.textContent).toContain("It remains unchanged until you save");
    await click("Discard recording"); expect(change).not.toHaveBeenCalled();
    expect(container.querySelector("audio")!.src).toBe(original.dataUrl); expect(busy).toHaveBeenLastCalledWith(false);
  });
  it("requires confirmation to remove a saved note and offers cancel", async () => {
    await render(note); await click("Remove audio note"); expect(change).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe("Confirm removal");
    await click("Cancel"); expect(change).not.toHaveBeenCalled();
    await click("Remove audio note"); await click("Confirm removal");
    expect(change).toHaveBeenCalledWith(undefined); expect(container.querySelector("audio")).toBeNull();
  });
  it("shows actionable permission errors and lets an ignored permission request be canceled", async () => {
    mock.start.mockImplementation(() => mock.callbacks!.state("requesting"));
    await render(); await click("Record audio note"); expect(container.textContent).toContain("Waiting for microphone");
    await click("Cancel microphone request"); expect(mock.cancel).toHaveBeenCalled();
    await act(async () => mock.callbacks!.error("permission")); expect(container.querySelector('[role="alert"]')?.textContent).toContain("Microphone access was denied");
    expect(change).not.toHaveBeenCalled();
  });
  it("retains playback and download when recording APIs are unavailable", async () => {
    mock.supported = false; await render(note);
    expect(container.textContent).toContain("Audio recording is unavailable");
    expect([...container.querySelectorAll("button")].find(button => button.textContent === "Record replacement note")?.disabled).toBe(true);
    expect(container.querySelector("audio")!.src).toBe(note.dataUrl); expect(container.querySelector("a")?.textContent).toContain("Download audio note");
  });
});
