import { describe, expect, it } from "vitest";
import { normalizeAppData } from "./database";
import { createRun, type DriverDebrief } from "./types";
import { createDriverDebrief, debriefBlob, debriefClock, debriefExtension, debriefMimeType, MAX_DEBRIEF_BYTES, validDriverDebrief } from "./driver-debrief";
import { buildFullBackup, parseFullBackup } from "./track-map/backup";
import { emptyTrackMapData } from "./track-map/types";
import { makeAppData, makeEvent, makeRun, makeSession } from "./test-fixtures";

export const sampleDebrief = (): DriverDebrief => ({ recordedAt: "2026-10-12T09:00:00.000Z", durationMs: 3500, mimeType: "audio/webm", size: 4, dataUrl: "data:audio/webm;base64,AQIDBA==" });
const withDebrief = (driverDebrief: DriverDebrief) => makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs: [makeRun({ driverDebrief })] })] })] });

describe("portable driver debrief", () => {
  it.each(["audio/webm", "audio/mp4", "audio/ogg"] as const)("preserves %s bytes through JSON backup and restore", async mimeType => {
    const note = { ...sampleDebrief(), mimeType, dataUrl: `data:${mimeType};base64,AQIDBA==` };
    const data = withDebrief(note);
    const restored = parseFullBackup(JSON.parse(await buildFullBackup(data, emptyTrackMapData())))!;
    expect(restored.appData).toEqual(data);
    const reader = new FileReader();
    const result = new Promise(resolve => { reader.onload = () => resolve(reader.result); });
    reader.readAsDataURL(debriefBlob(restored.appData.events[0].sessions[0].runs[0].driverDebrief!));
    expect(await result).toBe(note.dataUrl);
  });
  it("keeps older records without attaching or copying audio", () => {
    expect(normalizeAppData(makeAppData())!.events[0].sessions[0].runs[0].driverDebrief).toBeUndefined();
    expect(createRun(2, makeRun({ driverDebrief: sampleDebrief() })).driverDebrief).toBeUndefined();
  });
  it.each([
    { mimeType: "text/html" }, { mimeType: "video/webm" }, { dataUrl: "data:audio/mp4;base64,AQIDBA==" },
    { dataUrl: "data:audio/webm;base64,not-valid" }, { dataUrl: "data:audio/webm;base64,AQIDBA==,tail" },
    { dataUrl: "data:audio/webm;base64,AQIDBA=" }, { dataUrl: "data:audio/webm;base64," },
    { dataUrl: "data:audio/webm;base64,AQIDBA==\n" }, { size: 3 }, { size: MAX_DEBRIEF_BYTES + 1 },
    { size: 0 }, { durationMs: 0 }, { durationMs: 60_001 }, { durationMs: 1.5 },
    { recordedAt: "2026-02-30T09:00:00.000Z" }, { recordedAt: "invalid" },
  ])("rejects malformed or unbounded audio before replacement: %j", invalid => {
    const note = { ...sampleDebrief(), ...invalid };
    expect(validDriverDebrief(note)).toBe(false);
    expect(normalizeAppData(withDebrief(note as DriverDebrief))).toBeNull();
    expect(() => debriefBlob(note as DriverDebrief)).toThrow();
  });
  it("accepts the maximum size without losing bytes", () => {
    const note = { ...sampleDebrief(), size: MAX_DEBRIEF_BYTES, dataUrl: `data:audio/webm;base64,${btoa("a".repeat(MAX_DEBRIEF_BYTES))}` };
    expect(validDriverDebrief(note)).toBe(true);
  });
  it("normalizes recorder codec metadata into a portable audio note", async () => {
    const note = await createDriverDebrief(new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm;codecs=opus" }), 3500, sampleDebrief().recordedAt);
    expect(note).toEqual(sampleDebrief());
    expect(debriefMimeType("audio/mp4; codecs=mp4a.40.2")).toBe("audio/mp4");
    expect(debriefExtension("audio/mp4")).toBe("m4a");
    expect(debriefClock(3500)).toBe("0:04");
    expect(debriefClock(60_000)).toBe("1:00");
  });
  it.each([new Blob([], { type: "audio/webm" }), new Blob(["bad"], { type: "video/webm" }), new Blob(["a".repeat(MAX_DEBRIEF_BYTES + 1)], { type: "audio/webm" })])("rejects empty, nonaudio and oversized captures", async blob => {
    await expect(createDriverDebrief(blob, 3500, sampleDebrief().recordedAt)).rejects.toThrow();
  });
});
