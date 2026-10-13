import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoggerPhotoPanel } from "../components/logger-photo";
import { LanguageProvider } from "./i18n";
import { captureLoggerPhoto } from "./logger-photo";
import { readLoggerPhoto } from "./logger-ocr";
import { makeRun } from "./test-fixtures";
import type { LoggerPhoto, RunRecord } from "./types";
vi.mock("./logger-photo", async original => ({ ...await original<typeof import("./logger-photo")>(), captureLoggerPhoto: vi.fn() }));
vi.mock("./logger-ocr", () => ({ readLoggerPhoto: vi.fn() }));
const photo: LoggerPhoto = { capturedAt: "2026-10-13T09:00:00.000Z", sourceName: "logger.png", mimeType: "image/png", size: 4, width: 1200, height: 800, dataUrl: "data:image/png;base64,AQIDBA==" };
let root: Root; let container: HTMLDivElement; const save = vi.fn(); const remove = vi.fn(); const busy = vi.fn();
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  vi.mocked(captureLoggerPhoto).mockResolvedValue(photo);
  vi.mocked(readLoggerPhoto).mockReturnValue({ result: Promise.resolve("BEST LAP 48.321\nLAPS 14\nMAX RPM 15900"), cancel: vi.fn() });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render(run: RunRecord = makeRun()) { await act(async () => root.render(createElement(LanguageProvider, null, createElement(LoggerPhotoPanel, { run, onSave: save, onRemove: remove, onBusyChange: busy })))); }
async function click(label: string) { const button = [...container.querySelectorAll("button")].find(button => button.textContent?.trim() === label); if (!button) throw Error(`Missing ${label}`); await act(async () => button.click()); }
async function upload() { const input = container.querySelector<HTMLInputElement>('[aria-label="Photo file"]')!; Object.defineProperty(input, "files", { configurable: true, value: [new File(["test"], "logger.png", { type: "image/png" })] }); await act(async () => input.dispatchEvent(new Event("change", { bubbles: true }))); }
async function fill(index: number, value: string) { const input = container.querySelectorAll<HTMLInputElement>(".logger-reading .input")[index]; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); }

describe("logger photo review", () => {
  it("never changes readings automatically and applies only explicitly checked values", async () => {
    await render(); await upload(); expect(save).not.toHaveBeenCalled(); expect(busy).toHaveBeenLastCalledWith(true);
    await click("Read photo on this device");
    const inputs = container.querySelectorAll<HTMLInputElement>(".logger-reading .input"); expect([...inputs].map(input => input.value)).toEqual(["48.321", "14", "15900"]);
    const choices = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'); expect([...choices].every(input => !input.checked)).toBe(true);
    await act(async () => choices[0].click()); await click("Save photo and selected readings");
    expect(save).toHaveBeenCalledWith(photo, { fastestLap: "48.321" }); expect(busy).toHaveBeenLastCalledWith(false);
  });
  it("retains the original saved photo when replacement is discarded, and confirms removal", async () => {
    await render(makeRun({ loggerPhoto: photo })); await upload(); await click("Discard photo draft");
    expect(save).not.toHaveBeenCalled(); expect(container.querySelector("img")!.src).toBe(photo.dataUrl);
    await click("Remove logger photo"); expect(remove).not.toHaveBeenCalled(); await click("Cancel");
    await click("Remove logger photo"); await click("Confirm removal"); expect(remove).toHaveBeenCalledTimes(1);
  });
  it("supports manual review after OCR failure and rejects invalid selected values", async () => {
    vi.mocked(readLoggerPhoto).mockImplementation(() => ({ result: Promise.reject(new Error("OCR failed")), cancel: vi.fn() }));
    await render(); await upload(); await click("Read photo on this device"); expect(container.textContent).toContain("enter readings from the photo manually");
    await fill(2, "1e4"); await act(async () => container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[2].click());
    await click("Save photo and selected readings"); expect(save).not.toHaveBeenCalled(); expect(container.textContent).toContain("Check the selected readings");
    await fill(2, "15900"); await click("Save photo and selected readings"); expect(save).toHaveBeenCalledWith(photo, { maxRpm: "15900" });
  });
  it("cancels recognition while keeping the photo available to save without guessed readings", async () => {
    let reject!: (reason: unknown) => void; const pending = new Promise<string>((_resolve, rejectPromise) => { reject = rejectPromise; });
    const cancel = vi.fn(() => reject(new DOMException("Canceled", "AbortError")));
    vi.mocked(readLoggerPhoto).mockReturnValue({ result: pending, cancel });
    await render(); await upload(); await click("Read photo on this device"); await click("Cancel recognition"); expect(cancel).toHaveBeenCalled();
    await click("Save photo and selected readings"); expect(save).toHaveBeenCalledWith(photo, {});
  });
  it("can cancel a slow photo read and ignores its late completion", async () => {
    let finish!: (photo: LoggerPhoto) => void; vi.mocked(captureLoggerPhoto).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    await render(); await upload(); await click("Cancel photo loading"); await act(async () => finish(photo));
    expect(container.querySelector(".logger-photo-review")).toBeNull(); expect(busy).toHaveBeenLastCalledWith(false);
  });
});
