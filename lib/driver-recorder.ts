import { createDriverDebrief, MAX_DEBRIEF_BYTES, MAX_DEBRIEF_DURATION_MS } from "./driver-debrief";
import type { DriverDebrief } from "./types";

export type RecorderState = "idle" | "requesting" | "recording" | "processing";
export type RecorderError = "unsupported" | "permission" | "unavailable" | "too-large" | "failed";
type Callbacks = {
  state: (state: RecorderState) => void;
  elapsed: (milliseconds: number) => void;
  complete: (note: DriverDebrief) => void;
  error: (error: RecorderError) => void;
};

export function canRecordDebrief(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === true
    && typeof navigator.mediaDevices?.getUserMedia === "function" && typeof MediaRecorder !== "undefined";
}

/** Owns permission requests, recording and microphone release, independently of React renders. */
export class DriverRecorder {
  private state: RecorderState = "idle";
  private generation = 0;
  private disposed = false;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private ticker: ReturnType<typeof setInterval> | undefined;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private started = 0;
  private duration = 0;
  private readonly background = () => {
    if (document.visibilityState === "hidden") {
      if (this.state === "requesting") this.cancel();
      else this.stop();
    }
  };
  private readonly pagehide = () => { if (this.state === "requesting") this.cancel(); else this.stop(); };

  constructor(private callbacks: Callbacks) {}

  private change(state: RecorderState) {
    this.state = state;
    if (!this.disposed) this.callbacks.state(state);
  }
  private clearTimers() {
    clearInterval(this.ticker); clearTimeout(this.deadline);
    this.ticker = undefined; this.deadline = undefined;
  }
  private releaseStream() {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }
  private removeBackgroundHandlers() {
    document.removeEventListener("visibilitychange", this.background);
    window.removeEventListener("pagehide", this.pagehide);
  }
  private fail(error: RecorderError) {
    this.cancel();
    if (!this.disposed) this.callbacks.error(error);
  }

  async start(): Promise<void> {
    if (this.disposed || this.state !== "idle") return;
    if (!canRecordDebrief()) { this.callbacks.error("unsupported"); return; }
    const generation = ++this.generation;
    this.change("requesting");
    document.addEventListener("visibilitychange", this.background);
    window.addEventListener("pagehide", this.pagehide);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (this.disposed || generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      if (document.visibilityState === "hidden") { this.cancel(); return; }
      const formats = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm", "audio/ogg"];
      const mimeType = formats.find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 96_000 });
      this.recorder = recorder;
      const recordedAt = new Date().toISOString();
      const chunks: Blob[] = [];
      let bytes = 0;
      const current = () => !this.disposed && generation === this.generation;
      recorder.ondataavailable = event => {
        if (!current() || !event.data.size) return;
        bytes += event.data.size;
        if (bytes > MAX_DEBRIEF_BYTES) { this.fail("too-large"); return; }
        chunks.push(event.data);
      };
      recorder.onerror = () => { if (current()) this.fail("failed"); };
      recorder.onstop = async () => {
        if (!current()) return;
        if (this.state === "recording") this.duration = this.elapsed();
        this.clearTimers(); this.releaseStream(); this.removeBackgroundHandlers();
        this.change("processing");
        try {
          const note = await createDriverDebrief(new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type }), Math.max(1, this.duration), recordedAt);
          if (!current()) return;
          this.recorder = null; this.change("idle"); this.callbacks.complete(note);
        } catch { if (current()) this.fail("failed"); }
      };
      this.started = performance.now(); this.duration = 0;
      recorder.start(1000);
      this.change("recording"); this.callbacks.elapsed(0);
      this.ticker = setInterval(() => this.callbacks.elapsed(this.elapsed()), 250);
      this.deadline = setTimeout(() => this.stop(), MAX_DEBRIEF_DURATION_MS);
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      const name = error && typeof error === "object" && "name" in error ? error.name : "";
      this.fail(name === "NotAllowedError" || name === "SecurityError" ? "permission" : name === "NotFoundError" || name === "NotReadableError" ? "unavailable" : "failed");
    }
  }

  private elapsed() { return Math.min(MAX_DEBRIEF_DURATION_MS, Math.max(0, Math.round(performance.now() - this.started))); }

  stop() {
    if (this.state !== "recording" || !this.recorder) return;
    this.duration = this.elapsed(); this.callbacks.elapsed(this.duration);
    this.clearTimers(); this.change("processing");
    try { if (this.recorder.state !== "inactive") this.recorder.stop(); }
    catch { this.fail("failed"); }
    this.releaseStream();
  }

  /** A late permission grant or queued recorder event cannot resurrect a canceled recording. */
  cancel() {
    ++this.generation;
    this.clearTimers(); this.removeBackgroundHandlers();
    if (this.recorder) {
      this.recorder.ondataavailable = null; this.recorder.onstop = null; this.recorder.onerror = null;
      try { if (this.recorder.state !== "inactive") this.recorder.stop(); } catch { /* stream release still required */ }
      this.recorder = null;
    }
    this.releaseStream(); this.change("idle");
  }
  dispose() { this.disposed = true; this.cancel(); }
}
