import { afterEach, describe, expect, it, vi } from "vitest";
import { watchAppUpdates } from "./service-worker-updates";

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function setup(controlled = true, waiting = false) {
  const installing = new EventTarget();
  const registration = Object.assign(new EventTarget(), { installing, waiting: waiting ? {} : null, update: vi.fn().mockResolvedValue(undefined) });
  const container = { controller: controlled ? {} : null, register: vi.fn().mockResolvedValue(registration) };
  const notice = vi.fn();
  const cleanup = watchAppUpdates(container as unknown as ServiceWorkerContainer, notice);
  cleanups.push(cleanup);
  return { registration, container, installing, notice, cleanup };
}

describe("waiting app updates", () => {
  it("reports an already waiting update without sending activation messages", async () => {
    const { notice, container } = setup(true, true); await flush();
    expect(notice).toHaveBeenCalledOnce();
    expect(container.register).toHaveBeenCalledWith("/sw.js", { updateViaCache: "none" });
  });

  it("does not announce the first installation as an update", async () => {
    const { notice } = setup(false, true); await flush(); expect(notice).not.toHaveBeenCalled();
  });

  it("announces a newly installed waiting worker while leaving the current page alone", async () => {
    const { registration, installing, notice } = setup(); await flush();
    registration.waiting = {};
    installing.dispatchEvent(new Event("statechange")); await flush();
    expect(notice).toHaveBeenCalledOnce();
    expect(registration.update).not.toHaveBeenCalled();
  });

  it("checks on return to the tab and cleans up listeners", async () => {
    const { registration, notice, cleanup, installing } = setup(); await flush();
    window.dispatchEvent(new Event("focus")); expect(registration.update).toHaveBeenCalledOnce();
    cleanup(); registration.waiting = {}; installing.dispatchEvent(new Event("statechange"));
    window.dispatchEvent(new Event("focus")); await flush();
    expect(registration.update).toHaveBeenCalledOnce(); expect(notice).not.toHaveBeenCalled();
  });

  it("ignores late registration completion after unmount", async () => {
    const { cleanup, notice } = setup(true, true); cleanup(); await flush(); expect(notice).not.toHaveBeenCalled();
  });

  it("tolerates failed registration without blocking the app", async () => {
    const container = { register: vi.fn().mockRejectedValue(new Error("Unavailable")) };
    const notice = vi.fn(); cleanups.push(watchAppUpdates(container as unknown as ServiceWorkerContainer, notice));
    await flush(); expect(notice).not.toHaveBeenCalled();
  });
});
