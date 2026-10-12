import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canRecordDebrief, DriverRecorder } from "./driver-recorder";
import { createDriverDebrief, MAX_DEBRIEF_BYTES } from "./driver-debrief";

vi.mock("./driver-debrief", async original => ({ ...await original<typeof import("./driver-debrief")>(), createDriverDebrief: vi.fn() }));
const note = { recordedAt: "2026-10-12T09:00:00.000Z", durationMs: 1000, mimeType: "audio/webm" as const, size: 4, dataUrl: "data:audio/webm;base64,AQIDBA==" };
let recorders: FakeRecorder[];
const latest = () => recorders.at(-1)!;
let controller: DriverRecorder;
let tracks: { stop: ReturnType<typeof vi.fn> }[];
let getUserMedia: ReturnType<typeof vi.fn>;
const makeCallbacks = () => ({ state: vi.fn<(state: string) => void>(), elapsed: vi.fn<(time: number) => void>(), complete: vi.fn<(note: unknown) => void>(), error: vi.fn<(error: string) => void>() });
let callbacks: ReturnType<typeof makeCallbacks>;

class FakeRecorder {
  static isTypeSupported = vi.fn((type: string) => type.startsWith("audio/"));
  state = "inactive";
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: MediaStream, options: MediaRecorderOptions) { recorders.push(this); this.mimeType = options.mimeType ?? "audio/webm"; }
  start() { this.state = "recording"; }
  stop = vi.fn(() => {
    this.state = "inactive";
    queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(["1234"], { type: this.mimeType }) }); this.onstop?.(); });
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] });
  vi.stubGlobal("isSecureContext", true); vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  recorders = []; tracks = [{ stop: vi.fn() }]; getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => tracks });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  callbacks = makeCallbacks();
  controller = new DriverRecorder(callbacks);
  vi.mocked(createDriverDebrief).mockReset().mockResolvedValue(note);
  FakeRecorder.isTypeSupported.mockReset().mockReturnValue(true);
});
afterEach(() => { controller.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe("driver microphone lifecycle", () => {
  it("requests audio only and waits for final data after stop, releasing every track", async () => {
    expect(getUserMedia).not.toHaveBeenCalled();
    await controller.start(); await vi.advanceTimersByTimeAsync(1500);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    controller.stop(); controller.stop();
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(callbacks.complete).not.toHaveBeenCalled();
    await flush();
    expect(latest().stop).toHaveBeenCalledTimes(1);
    expect(createDriverDebrief).toHaveBeenCalledWith(expect.objectContaining({ size: 4 }), 1500, expect.any(String));
    expect(callbacks.complete).toHaveBeenCalledWith(note);
    expect(callbacks.state).toHaveBeenLastCalledWith("idle");
  });
  it("automatically ends a one-minute note", async () => {
    await controller.start(); await vi.advanceTimersByTimeAsync(60_000); await flush();
    expect(latest().stop).toHaveBeenCalledTimes(1);
    expect(createDriverDebrief).toHaveBeenCalledWith(expect.any(Blob), 60_000, expect.any(String));
    expect(tracks[0].stop).toHaveBeenCalled();
  });
  it.each(["visibilitychange", "pagehide"])("stops when the page is backgrounded: %s", async event => {
    await controller.start(); await vi.advanceTimersByTimeAsync(2000);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    (event === "pagehide" ? window : document).dispatchEvent(new Event(event)); await flush();
    expect(callbacks.complete).toHaveBeenCalledWith(note); expect(tracks[0].stop).toHaveBeenCalled();
  });
  it("ignores repeated starts and cancels a late microphone grant", async () => {
    let grant!: (value: unknown) => void;
    getUserMedia.mockReturnValue(new Promise(resolve => { grant = resolve; }));
    const opening = controller.start(); void controller.start();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    controller.cancel(); grant({ getTracks: () => tracks }); await opening;
    expect(tracks[0].stop).toHaveBeenCalled(); expect(callbacks.complete).not.toHaveBeenCalled();
    expect(callbacks.state).toHaveBeenLastCalledWith("idle");
  });
  it("releases a late permission grant after unmount without callbacks", async () => {
    let grant!: (value: unknown) => void;
    getUserMedia.mockReturnValue(new Promise(resolve => { grant = resolve; }));
    const opening = controller.start(); controller.dispose(); callbacks.state.mockClear();
    grant({ getTracks: () => tracks }); await opening;
    expect(tracks[0].stop).toHaveBeenCalled(); expect(callbacks.state).not.toHaveBeenCalled();
  });
  it.each([["NotAllowedError", "permission"], ["NotFoundError", "unavailable"], ["NotReadableError", "unavailable"], ["UnknownError", "failed"]])("handles %s without attaching audio", async (name, expected) => {
    getUserMedia.mockRejectedValue(new DOMException("Unavailable", name)); await controller.start();
    expect(callbacks.error).toHaveBeenCalledWith(expected); expect(callbacks.complete).not.toHaveBeenCalled();
  });
  it("falls back to an available audio container", async () => {
    FakeRecorder.isTypeSupported.mockImplementation(type => type === "audio/mp4");
    await controller.start(); expect(latest().mimeType).toBe("audio/mp4");
  });
  it("cancels on recorder failure and never attaches the queued final data", async () => {
    await controller.start(); latest().onerror?.(); await flush();
    expect(callbacks.error).toHaveBeenCalledWith("failed"); expect(callbacks.complete).not.toHaveBeenCalled();
    expect(tracks[0].stop).toHaveBeenCalled();
  });
  it("rejects oversized recordings and releases the microphone", async () => {
    await controller.start(); latest().ondataavailable?.({ data: new Blob(["x".repeat(MAX_DEBRIEF_BYTES + 1)], { type: "audio/webm" }) }); await flush();
    expect(callbacks.error).toHaveBeenCalledWith("too-large"); expect(callbacks.complete).not.toHaveBeenCalled();
    expect(tracks[0].stop).toHaveBeenCalled();
  });
  it("handles conversion errors without leaving a live microphone", async () => {
    vi.mocked(createDriverDebrief).mockRejectedValue(new Error("Encoding failed"));
    await controller.start(); controller.stop(); await flush();
    expect(callbacks.error).toHaveBeenCalledWith("failed"); expect(tracks[0].stop).toHaveBeenCalled();
  });
  it("discards a canceled note before encoding", async () => {
    await controller.start(); controller.cancel(); await flush();
    expect(createDriverDebrief).not.toHaveBeenCalled(); expect(callbacks.complete).not.toHaveBeenCalled();
    expect(tracks[0].stop).toHaveBeenCalled();
  });
  it("requires supported APIs and a secure page", async () => {
    vi.stubGlobal("isSecureContext", false);
    expect(canRecordDebrief()).toBe(false); await controller.start();
    expect(callbacks.error).toHaveBeenCalledWith("unsupported"); expect(getUserMedia).not.toHaveBeenCalled();
  });
});
