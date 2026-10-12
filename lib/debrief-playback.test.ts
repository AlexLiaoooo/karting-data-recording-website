import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DebriefPlayback } from "../components/debrief-playback";
import { LanguageProvider } from "./i18n";
import type { DriverDebrief } from "./types";

const note: DriverDebrief = { recordedAt: "2026-10-12T09:00:00.000Z", durationMs: 4500, mimeType: "audio/mp4", size: 4, dataUrl: "data:audio/mp4;base64,AQIDBA==" };
let root: Root; let container: HTMLDivElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render(recording = note) { await act(async () => root.render(createElement(LanguageProvider, null, createElement(DebriefPlayback, { note: recording, runNumber: 3, runId: "my-run/unsafe" })))); }

describe("saved driver audio playback", () => {
  it("keeps playback user initiated and downloads the original audio under a Run-specific filename", async () => {
    await render();
    const audio = container.querySelector("audio")!;
    expect(audio.controls).toBe(true); expect(audio.autoplay).toBe(false); expect(audio.preload).toBe("none");
    expect(audio.src).toBe(note.dataUrl); expect(audio.getAttribute("aria-label")).toBe("Driver debrief audio");
    const link = container.querySelector("a")!;
    expect(link.href).toBe(note.dataUrl); expect(link.download).toBe("kart-debrief-2026-10-12-run-03-my-runun.m4a");
    expect(container.textContent).toContain("0:05");
  });
  it("offers a download fallback after playback failure and clears that error for a new recording", async () => {
    await render(); await act(async () => container.querySelector("audio")!.dispatchEvent(new Event("error")));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Download it");
    expect(container.querySelector("a")?.href).toBe(note.dataUrl);
    await render({ ...note, recordedAt: "2026-10-12T09:02:00.000Z" });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
