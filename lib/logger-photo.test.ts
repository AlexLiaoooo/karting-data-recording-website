import { describe, expect, it } from "vitest";
import { normalizeAppData } from "./database";
import { createRun, type LoggerPhoto } from "./types";
import { validLoggerPhoto, MAX_LOGGER_PHOTO_BYTES, loggerPhotoBlob } from "./logger-photo";
import { mediaDataUrl } from "./portable-media";
import { makeAppData, makeRun } from "./test-fixtures";
import { buildFullBackup, parseFullBackup } from "./track-map/backup";
import { emptyTrackMapData } from "./track-map/types";

const photo: LoggerPhoto = { capturedAt: "2026-10-13T09:00:00.000Z", sourceName: "logger.png", mimeType: "image/png", size: 4, width: 1200, height: 800, dataUrl: "data:image/png;base64,AQIDBA==" };
describe("logger photo evidence", () => {
  it("stores native photos without base64 and exports/restores the same portable bytes", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    const native = { ...photo, dataUrl: undefined, blob };
    expect(validLoggerPhoto(native)).toBe(true);
    const data = makeAppData(); data.events[0].sessions[0].runs[0].loggerPhoto = native;
    const payload = JSON.parse(await buildFullBackup(data, emptyTrackMapData()));
    expect(payload.appData.events[0].sessions[0].runs[0].loggerPhoto.dataUrl).toBe(photo.dataUrl);
    expect(payload.appData.events[0].sessions[0].runs[0].loggerPhoto.blob).toBeUndefined();
    const restored = parseFullBackup(payload)!.appData.events[0].sessions[0].runs[0].loggerPhoto!;
    expect(restored.blob?.size).toBe(4); expect(await mediaDataUrl(loggerPhotoBlob(restored))).toBe(photo.dataUrl);
  });
  it("rejects mismatched native photo bytes, type and duplicate representations", () => {
    expect(validLoggerPhoto({ ...photo, dataUrl: undefined, blob: new Blob(["bad"], { type: "image/png" }) })).toBe(false);
    expect(validLoggerPhoto({ ...photo, dataUrl: undefined, blob: new Blob(["1234"], { type: "image/jpeg" }) })).toBe(false);
    expect(validLoggerPhoto({ ...photo, blob: new Blob(["1234"], { type: "image/png" }) })).toBe(false);
  });
  it.each(["image/png", "image/jpeg", "image/webp"] as const)("preserves %s bytes through JSON backup", async mimeType => {
    const data = makeAppData(); data.events[0].sessions[0].runs[0].loggerPhoto = { ...photo, mimeType, dataUrl: `data:${mimeType};base64,AQIDBA==` };
    const parsed = parseFullBackup(JSON.parse(await buildFullBackup(data, emptyTrackMapData())))!;
    const stored = parsed.appData.events[0].sessions[0].runs[0].loggerPhoto!;
    expect(stored.dataUrl).toBeUndefined(); expect(stored.blob?.size).toBe(4);
    expect(await mediaDataUrl(loggerPhotoBlob(stored))).toBe(`data:${mimeType};base64,AQIDBA==`);
    expect(stored.sourceName).toBe(photo.sourceName);
  });
  it("does not invent legacy photos or copy original evidence to a new Run", () => {
    expect(normalizeAppData(makeAppData())!.events[0].sessions[0].runs[0].loggerPhoto).toBeUndefined();
    expect(createRun(2, makeRun({ loggerPhoto: photo })).loggerPhoto).toBeUndefined();
  });
  it.each([{ mimeType: "image/svg+xml" }, { dataUrl: "data:text/html;base64,AQIDBA==" }, { dataUrl: "data:image/png;base64,AQIDBA==,tail" }, { dataUrl: "data:image/png;base64,AQIDBA=" }, { size: 3 }, { size: 0 }, { size: MAX_LOGGER_PHOTO_BYTES + 1 }, { width: 0 }, { height: 1.5 }, { width: 12001 }, { width: 8000, height: 8000 }, { capturedAt: "2026-02-30T09:00:00.000Z" }])("rejects unsafe evidence metadata before restore: %j", invalid => {
    const bad = { ...photo, ...invalid }; expect(validLoggerPhoto(bad)).toBe(false);
    const data = makeAppData(); data.events[0].sessions[0].runs[0].loggerPhoto = bad as LoggerPhoto;
    expect(normalizeAppData(data)).toBeNull();
  });
});
