import type { LoggerPhoto } from "./types";
import { validLoggerPhoto } from "./logger-photo";

/** A cancelable same-origin OCR job; the photograph is never sent to a server. */
export function readLoggerPhoto(photo: LoggerPhoto, progress: (percent: number) => void) {
  const controller = new AbortController();
  let worker: import("tesseract.js").Worker | null = null;
  let cancelReject: ((reason: Error) => void) | undefined;
  const canceled = new Promise<never>((_resolve, reject) => { cancelReject = reject; });
  const cancel = (reason: Error = new DOMException("Recognition canceled", "AbortError")) => {
    controller.abort();
    cancelReject?.(reason);
    void worker?.terminate();
  };
  const work = (async () => {
    if (!validLoggerPhoto(photo)) throw new Error("Invalid photo");
    const { createWorker, OEM, PSM } = await import("tesseract.js");
    if (controller.signal.aborted) throw new DOMException("Recognition canceled", "AbortError");
    // Fail missing/offline assets before spawning the worker, whose startup can otherwise stall.
    await Promise.all(["worker.min.js", "eng.traineddata.gz"].map(async name => {
      const response = await fetch(`/ocr/${name}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Recognition files unavailable");
    }));
    worker = await createWorker("eng", OEM.LSTM_ONLY, {
      workerPath: new URL("/ocr/worker.min.js", location.origin).href,
      corePath: new URL("/ocr/", location.origin).href,
      langPath: new URL("/ocr/", location.origin).href,
      legacyCore: false, legacyLang: false, workerBlobURL: false,
      logger: message => { if (!controller.signal.aborted) progress(Math.round(Math.max(0, Math.min(1, message.progress)) * 100)); },
      errorHandler: () => {},
    });
    try {
      if (controller.signal.aborted) throw new DOMException("Recognition canceled", "AbortError");
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const { data } = await worker.recognize(photo.blob ?? photo.dataUrl!);
      if (controller.signal.aborted) throw new DOMException("Recognition canceled", "AbortError");
      return data.text.slice(0, 20_000);
    } finally { await worker.terminate(); worker = null; }
  })();
  const timer = setTimeout(() => cancel(new DOMException("Recognition timed out", "TimeoutError")), 60_000);
  const result = Promise.race([work, canceled]).finally(() => clearTimeout(timer));
  return { result, cancel };
}
