/** Observe waiting updates without activating them or reloading an open session. */
export function watchAppUpdates(container: ServiceWorkerContainer, onWaiting: () => void) {
  let disposed = false;
  let registration: ServiceWorkerRegistration | undefined;
  const workers = new Map<ServiceWorker, () => void>();
  const inspect = () => { if (!disposed && registration?.waiting && container.controller) onWaiting(); };
  const followInstalling = () => {
    const worker = registration?.installing;
    if (!worker || workers.has(worker)) return;
    const changed = () => { queueMicrotask(inspect); };
    workers.set(worker, changed);
    worker.addEventListener("statechange", changed);
  };
  const refresh = () => {
    if (!disposed && navigator.onLine !== false) void registration?.update().catch(() => undefined);
  };
  const visible = () => { if (document.visibilityState === "visible") refresh(); };
  void Promise.resolve().then(() => disposed ? undefined : container.register("/sw.js", { updateViaCache: "none" })).then(value => {
    if (disposed || !value) return;
    registration = value;
    inspect();
    followInstalling();
    registration.addEventListener("updatefound", followInstalling);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
  }).catch(() => undefined);
  return () => {
    disposed = true;
    registration?.removeEventListener("updatefound", followInstalling);
    for (const [worker, listener] of workers) worker.removeEventListener("statechange", listener);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", visible);
  };
}
