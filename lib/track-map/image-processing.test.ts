import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { optimiseMapImage } from "./image-processing";
import { validStoredTrackMap } from "../validation";
import { makeAppData, makeTrackMapData, blobBytes } from "../test-fixtures";
import { buildFullBackup, parseFullBackup } from "./backup";

let encode: MockInstance<HTMLCanvasElement["toBlob"]>;
beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:input"), revokeObjectURL: vi.fn() }));
  vi.stubGlobal("Image", class {
    naturalWidth = 3200; naturalHeight = 2400;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect() {}, drawImage() {} } as unknown as CanvasRenderingContext2D);
  encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("map encoder output", () => {
  it.each(["image/webp", "image/png"])("retains actual %s bytes and valid metadata through backup", async type => {
    encode.mockImplementation(callback => callback(new Blob([new Uint8Array([1, 2, 3, 4])], { type })));
    const asset = await optimiseMapImage(new File(["photo"], "track.png", { type: "image/png" }));
    expect(asset).toMatchObject({ mimeType: type, size: 4, width: 1600, height: 1200 });
    const maps = makeTrackMapData({ assets: [asset], layouts: [], visits: [] });
    expect(validStoredTrackMap(maps)).toBe(true);
    const restored = parseFullBackup(JSON.parse(await buildFullBackup(makeAppData(), { ...maps, visits: [] })))!;
    expect(restored.trackMapData.assets[0].mimeType).toBe(type);
    expect(await blobBytes(restored.trackMapData.assets[0].blob)).toEqual([1, 2, 3, 4]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:input");
  });
  it("uses the actual JPEG fallback when WebP encoding returns null", async () => {
    encode.mockImplementationOnce(callback => callback(null)).mockImplementationOnce(callback => callback(new Blob(["jpeg"], { type: "image/jpeg" })));
    expect((await optimiseMapImage(new File(["photo"], "track.png", { type: "image/png" }))).mimeType).toBe("image/jpeg");
    expect(encode.mock.calls.map(call => call[1])).toEqual(["image/webp", "image/jpeg"]);
  });
  it.each([null, new Blob([], { type: "image/png" }), new Blob(["text"], { type: "text/plain" })])("rejects missing, empty or non-image output", async blob => {
    encode.mockImplementation(callback => callback(blob));
    await expect(optimiseMapImage(new File(["photo"], "track.png", { type: "image/png" }))).rejects.toThrow("could not be saved");
  });
});
