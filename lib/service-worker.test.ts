// @vitest-environment node
import { afterAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "kart-data-sw-test-"));
mkdirSync(join(temporaryDirectory, "out"));
writeFileSync(join(temporaryDirectory, "out", "index.html"), "Kart Data");
execFileSync(process.execPath, [resolve("scripts/generate-sw.mjs")], { cwd: temporaryDirectory });
afterAll(() => rmSync(temporaryDirectory, { recursive: true, force: true }));

function worker(source: string) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const cached = { ok: true, name: "saved app shell" };
  const response = { ok: true, status: 200, clone: () => response };
  const put = vi.fn().mockResolvedValue(undefined);
  const cache = {
    keys: vi.fn().mockResolvedValue(["kart-data-old", "other-feature-cache"]),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn().mockResolvedValue(cached),
    open: vi.fn().mockResolvedValue({ put }),
  };
  const fetch = vi.fn().mockResolvedValue(response);
  const claim = vi.fn().mockResolvedValue(undefined);
  runInNewContext(source, {
    self: {
      addEventListener: (type: string, callback: (event: unknown) => void) => { listeners[type] = callback; },
      location: { origin: "https://kart.test" },
      clients: { claim },
    },
    caches: cache, fetch, URL,
  });
  async function navigate() {
    let result: Promise<unknown> | undefined;
    const tasks: Promise<unknown>[] = [];
    listeners.fetch({
      request: { method: "GET", destination: "document", url: "https://kart.test/" },
      respondWith: (promise: Promise<unknown>) => { result = promise; },
      waitUntil: (promise: Promise<unknown>) => { tasks.push(promise); },
    });
    const resolved = await result;
    await Promise.all(tasks);
    return resolved;
  }
  return { listeners, cached, response, cache, fetch, put, claim, navigate };
}

describe.each([
  ["fallback", readFileSync(resolve("public/sw.js"), "utf8")],
  ["generated production", readFileSync(join(temporaryDirectory, "out", "sw.js"), "utf8")],
])("%s service worker", (_name, source) => {
  it("removes only old Kart Data caches and claims clients after cleanup", async () => {
    const instance = worker(source);
    let task: Promise<unknown> | undefined;
    instance.listeners.activate({ waitUntil: (promise: Promise<unknown>) => { task = promise; } });
    expect(instance.claim).not.toHaveBeenCalled();
    await task;
    expect(instance.cache.delete.mock.calls).toEqual([["kart-data-old"]]);
    expect(instance.claim).toHaveBeenCalledOnce();
  });

  it("uses the saved app during a server error without caching the error page", async () => {
    const instance = worker(source);
    instance.fetch.mockResolvedValue({ ok: false, status: 503 });
    expect(await instance.navigate()).toBe(instance.cached);
    expect(instance.put).not.toHaveBeenCalled();
  });

  it("returns the server error if no saved shell exists", async () => {
    const instance = worker(source);
    const unavailable = { ok: false, status: 503 };
    instance.fetch.mockResolvedValue(unavailable);
    instance.cache.match.mockResolvedValue(undefined);
    expect(await instance.navigate()).toBe(unavailable);
  });

  it("keeps the saved app usable offline", async () => {
    const instance = worker(source);
    instance.fetch.mockRejectedValue(new Error("Offline"));
    expect(await instance.navigate()).toBe(instance.cached);
  });

  it("waits for successful navigation responses to reach the cache", async () => {
    const instance = worker(source);
    expect(await instance.navigate()).toBe(instance.response);
    expect(instance.put).toHaveBeenCalledOnce();
  });
});
