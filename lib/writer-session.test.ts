import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { loadData, openKartDatabase, saveData, transactionDone } from "./database";
import { claimWriter, releaseWriter, renewWriter } from "./writer-session";
import { WRITER_LEASE_MS, WriterConflictError } from "./writer-lease";
import { loadTrackMapData, restoreFullData, saveTrackMapData } from "./track-map/database";
import { makeAppData, makeTrackMapData } from "./test-fixtures";

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase("kart-data-recorder"); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
});
afterEach(() => vi.restoreAllMocks());

describe("editing ownership", () => {
  it("grants exactly one of two simultaneous claims without changing records", async () => {
    const data = makeAppData(); await saveData(data);
    expect((await Promise.all([claimWriter("one"), claimWriter("two")])).filter(Boolean)).toHaveLength(1);
    expect(await loadData()).toEqual(data);
  });

  it("allows takeover after expiry and rejects old app/map/restore writes atomically", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const data = makeAppData(); const maps = makeTrackMapData();
    maps.assets[0].blob = new NodeBlob([new Uint8Array([1, 2, 3, 4, 250, 251, 252, 253])], { type: "image/webp" }) as unknown as Blob;
    await restoreFullData(data, maps); await claimWriter("one");
    clock.mockReturnValue(now + WRITER_LEASE_MS + 1);
    expect(await claimWriter("two")).toBe(true);
    const changed = makeAppData({ events: [] });
    await expect(saveData(changed, "one")).rejects.toBeInstanceOf(WriterConflictError);
    await expect(saveTrackMapData({ ...maps, tracks: [] }, "one")).rejects.toBeInstanceOf(WriterConflictError);
    await expect(restoreFullData(changed, { ...maps, visits: [] }, "one")).rejects.toBeInstanceOf(WriterConflictError);
    expect(await loadData()).toEqual(data);
    const savedMaps = await loadTrackMapData();
    expect(savedMaps.tracks).toEqual(maps.tracks);
    expect(savedMaps.layouts).toEqual(maps.layouts);
    expect(await savedMaps.assets[0].blob.arrayBuffer()).toEqual(await maps.assets[0].blob.arrayBuffer());
    await saveData(changed, "two"); expect(await loadData()).toEqual(changed);
  });

  it("renews safely after suspension if nobody else claimed the records", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    await claimWriter("one"); clock.mockReturnValue(now + WRITER_LEASE_MS + 1);
    await renewWriter("one"); expect(await claimWriter("two")).toBe(false);
    await saveData(makeAppData(), "one");
  });

  it("cannot release or renew another tab's claim", async () => {
    await claimWriter("one"); await releaseWriter("two");
    await expect(renewWriter("two")).rejects.toBeInstanceOf(WriterConflictError);
    expect(await claimWriter("two")).toBe(false);
    await releaseWriter("one"); expect(await claimWriter("two")).toBe(true);
  });

  it("rolls back a renewed lease as well as records when a write fails", async () => {
    const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    await claimWriter("one"); clock.mockReturnValue(now + WRITER_LEASE_MS - 1);
    const invalid = makeAppData(); Object.assign(invalid, { cannotClone: () => {} });
    await expect(saveData(invalid, "one")).rejects.toThrow();
    clock.mockReturnValue(now + WRITER_LEASE_MS + 1);
    expect(await claimWriter("two")).toBe(true);
  });

  it("keeps lease metadata out of stored app records", async () => {
    await claimWriter("one"); expect((await loadData()).events).toEqual([]);
    const database = await openKartDatabase();
    const transaction = database.transaction("app", "readonly"); const done = transactionDone(transaction);
    expect(transaction.objectStore("app").keyPath).toBeNull(); await done; database.close();
  });
});
