import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readLoggerPhoto } from "./logger-ocr";
import { createWorker } from "tesseract.js";
import type { LoggerPhoto } from "./types";
vi.mock("tesseract.js", () => ({ createWorker: vi.fn(), OEM: { LSTM_ONLY: 1 }, PSM: { SPARSE_TEXT: 11 } }));
const photo: LoggerPhoto = { capturedAt: "2026-10-13T09:00:00.000Z", sourceName: "logger.png", mimeType: "image/png", size: 4, width: 1200, height: 800, dataUrl: "data:image/png;base64,AQIDBA==" };
const worker = { setParameters: vi.fn(), recognize: vi.fn(), terminate: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  vi.mocked(createWorker).mockResolvedValue(worker as unknown as Awaited<ReturnType<typeof createWorker>>);
  worker.recognize.mockResolvedValue({ data: { text: "BEST LAP 48.321\nLAPS 12\nMAX RPM 15800" } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("on-device logger OCR", () => {
  it("recognizes with same-origin files and releases the worker", async () => {
    const job = readLoggerPhoto(photo, vi.fn()); expect(await job.result).toContain("BEST LAP");
    expect(createWorker).toHaveBeenCalledWith("eng", 1, expect.objectContaining({ workerPath: `${location.origin}/ocr/worker.min.js`, corePath: `${location.origin}/ocr/`, langPath: `${location.origin}/ocr/`, workerBlobURL: false }));
    expect(worker.recognize).toHaveBeenCalledWith(photo.dataUrl); expect(worker.terminate).toHaveBeenCalled();
    for (const [url] of vi.mocked(fetch).mock.calls) expect(String(url).startsWith("/ocr/")).toBe(true);
  });
  it("fails unavailable recognition files without submitting a photo or starting a worker", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(readLoggerPhoto(photo, vi.fn()).result).rejects.toThrow("unavailable"); expect(createWorker).not.toHaveBeenCalled();
  });
  it("cancels a pending recognition and suppresses its late result", async () => {
    let complete!: (value: unknown) => void;
    worker.recognize.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const job = readLoggerPhoto(photo, vi.fn());
    await vi.waitFor(() => expect(worker.recognize).toHaveBeenCalled());
    job.cancel(); await expect(job.result).rejects.toMatchObject({ name: "AbortError" });
    complete({ data: { text: "Late result" } }); await Promise.resolve(); await Promise.resolve();
    expect(worker.terminate).toHaveBeenCalled();
  });
  it("releases the worker on decoding errors", async () => {
    worker.recognize.mockRejectedValue(new Error("Cannot decode photo"));
    await expect(readLoggerPhoto(photo, vi.fn()).result).rejects.toThrow("decode"); expect(worker.terminate).toHaveBeenCalled();
  });
});
