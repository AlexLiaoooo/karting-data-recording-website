import { beforeEach, describe, expect, it } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { vi } from "vitest";
import { emptyAppData, loadData, normalizeAppData, openKartDatabase, saveData, validateImport } from "./database";
import { loadTrackMapData, migrateMarkerTypes, restoreFullData, saveTrackMapData } from "./track-map/database";
import { makeLayout, makeMarker, makeMapAsset } from "./test-fixtures";
import type { TrackMarker } from "./track-map/types";
import { makeAppData, makeEvent, makeRun, makeSession, makeTrackMapData } from "./test-fixtures";

const DB_NAME = "kart-data-recorder";

function deleteDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

/** Recreates the schema shipped before the Track Map Notebook: version 1, `app` store only. */
function seedVersion1Database(payload: unknown) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("app");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("app", "readwrite");
      transaction.objectStore("app").put(payload, "primary");
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

beforeEach(async () => {
  await deleteDatabase();
});

// Node's Blob survives fake-indexeddb's structured clone; jsdom's Blob does not.
function storedTrackMaps() {
  const blob = new NodeBlob([new Uint8Array([1, 2, 3, 4, 250, 251, 252, 253])], { type: "image/webp" });
  return makeTrackMapData({ assets: [{ ...makeMapAsset(), blob: blob as unknown as Blob }] });
}

describe("safe startup reads", () => {
  it.each([null, { version: 2, events: [null] }, { version: 9, events: [] }])("rejects damaged saved records instead of presenting an empty database", async (stored) => {
    await seedVersion1Database(stored);
    await expect(loadData()).rejects.toThrow("could not be read safely");
    const database = await openKartDatabase();
    const request = database.transaction("app").objectStore("app").get("primary");
    const value = await new Promise((resolve) => { request.onsuccess = () => resolve(request.result); });
    database.close();
    expect(value).toEqual(stored);
  });

  it("rejects unavailable storage rather than treating it as a fresh install", async () => {
    vi.stubGlobal("indexedDB", undefined);
    try {
      await expect(loadData()).rejects.toThrow("unavailable");
      await expect(loadTrackMapData()).rejects.toThrow("unavailable");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects damaged Track Map records before attempting their migration", async () => {
    const database = await openKartDatabase();
    const transaction = database.transaction("trackLayouts", "readwrite");
    transaction.objectStore("trackLayouts").put({ id: "broken", markers: null });
    await new Promise((resolve) => { transaction.oncomplete = resolve; });
    database.close();
    await expect(loadTrackMapData()).rejects.toThrow("could not be read safely");
  });
});

describe("normalizeAppData", () => {
  it("upgrades a version 1 payload without changing records that are already current", () => {
    const legacy = { ...makeAppData(), version: 1 };
    const normalized = normalizeAppData(legacy);

    expect(normalized?.version).toBe(2);
    expect(normalized?.events).toEqual(legacy.events);
  });

  /**
   * React treats an input whose value is undefined as uncontrolled: the Run editor would warn on
   * render and then fight the first keystroke. Backfilling here covers stored data and restored
   * backups alike, because both arrive through this function.
   */
  it("backfills maxRpm on Runs recorded before the field existed", () => {
    const run: Record<string, unknown> = { ...makeRun() };
    delete run.maxRpm;
    const legacy = { ...makeAppData(), events: [{ ...makeEvent(), sessions: [{ ...makeSession(), runs: [run] }] }] };

    const restored = normalizeAppData(legacy)?.events[0].sessions[0].runs[0];
    expect(restored?.maxRpm).toBe("");
    // Everything else on the Run has to survive the migration untouched.
    expect(restored?.fastestLap).toBe("48.21");
    expect(restored?.setup.rearSprocket).toBe("82");
  });

  it("leaves a maxRpm that was already recorded alone", () => {
    expect(normalizeAppData(makeAppData())?.events[0].sessions[0].runs[0].maxRpm).toBe("15800");
  });

  it("defaults setupTemplates when the payload predates them", () => {
    const withoutTemplates: Record<string, unknown> = { ...makeAppData() };
    delete withoutTemplates.setupTemplates;
    expect(normalizeAppData(withoutTemplates)?.setupTemplates).toEqual([]);
  });

  it.each([["null", null], ["a string", "nope"], ["a wrong version", { version: 9, events: [] }], ["events that are not an array", { version: 2, events: {} }]])(
    "rejects %s",
    (_label, value) => {
      expect(normalizeAppData(value)).toBeNull();
      expect(validateImport(value)).toBe(false);
    },
  );
});

describe("schema upgrade from version 1", () => {
  it("preserves existing records and adds the Track Map stores", async () => {
    const existing = makeAppData();
    await seedVersion1Database({ ...existing, version: 1 });

    const database = await openKartDatabase();
    const storeNames = [...database.objectStoreNames];
    database.close();

    expect(storeNames).toEqual(expect.arrayContaining(["app", "tracks", "trackLayouts", "trackVisits", "mapAssets"]));
    expect((await loadData()).events).toEqual(existing.events);
  });

  it("leaves a fresh install with empty data rather than failing", async () => {
    expect(await loadData()).toEqual(emptyAppData());
    expect(await loadTrackMapData()).toEqual({ version: 1, tracks: [], layouts: [], visits: [], assets: [] });
  });
});

describe("migrateMarkerTypes", () => {
  const withType = (type: string) => [makeLayout({ markers: [makeMarker({ type: type as TrackMarker["type"], generalNote: "Late apex works" })] })];
  const migrated = (type: string) => migrateMarkerTypes(withType(type))[0].markers[0];

  it.each([["Turn-in", "In"], ["Apex", "Mid"], ["Exit", "Out"], ["Braking", "Brake"]])(
    "maps the corner phase %s to %s and leaves the note alone",
    (legacy, expected) => {
      const marker = migrated(legacy);
      expect(marker.type).toBe(expected);
      expect(marker.generalNote).toBe("Late apex works");
    },
  );

  it.each([["Corner", "Mid"], ["Hazard", "Others"], ["Overtaking", "Others"], ["Focus", "Others"]])(
    "moves %s to %s and records the original type in the note",
    (legacy, expected) => {
      const marker = migrated(legacy);
      expect(marker.type).toBe(expected);
      expect(marker.generalNote).toBe(`Previously marked as ${legacy}.\nLate apex works`);
    },
  );

  it("leaves a marker already on a current type untouched", () => {
    const layouts = withType("Gas");
    expect(migrateMarkerTypes(layouts)[0]).toBe(layouts[0]);
  });

  it("does not invent a note where the marker had none", () => {
    const layouts = [makeLayout({ markers: [makeMarker({ type: "Hazard" as TrackMarker["type"], generalNote: "" })] })];
    const marker = migrateMarkerTypes(layouts)[0].markers[0];
    expect(marker.type).toBe("Others");
    expect(marker.generalNote).toBe("Previously marked as Hazard.");
  });
});

describe("persistence round-trip", () => {
  it("stores and reloads app data", async () => {
    const data = makeAppData();
    await saveData(data);
    expect(await loadData()).toEqual(data);
  });

  it("stores and reloads track map records, and the asset box markers are relative to", async () => {
    await loadTrackMapData();
    const data = storedTrackMaps();
    await saveTrackMapData(data);
    const reloaded = await loadTrackMapData();

    expect(reloaded.tracks).toEqual(data.tracks);
    expect(reloaded.layouts).toEqual(data.layouts);
    expect(reloaded.visits).toEqual(data.visits);
    // The backup tests use browser FileReader; this test uses Node's cloneable Blob.
    expect(reloaded.assets[0]).toMatchObject({ id: "asset-1", width: 760, height: 1000, mimeType: "image/webp" });
  });

  it("removes records that were deleted, rather than merging them back", async () => {
    await loadTrackMapData();
    await saveTrackMapData(storedTrackMaps());
    await saveTrackMapData({ ...storedTrackMaps(), tracks: [], layouts: [], visits: [] });
    const reloaded = await loadTrackMapData();

    expect(reloaded.tracks).toEqual([]);
    expect(reloaded.layouts).toEqual([]);
    expect(reloaded.visits).toEqual([]);
  });

  it("keeps app data and track map data in separate stores", async () => {
    await loadTrackMapData();
    await saveData(makeAppData());
    await saveTrackMapData(storedTrackMaps());

    expect((await loadData()).events).toHaveLength(1);
    expect((await loadTrackMapData()).tracks).toHaveLength(1);
  });
});

describe("atomic restore", () => {
  it("commits records and map images together, including clearing maps for legacy backups", async () => {
    await restoreFullData(makeAppData(), storedTrackMaps());
    expect(await loadData()).toEqual(makeAppData());
    const maps = await loadTrackMapData();
    expect(maps.layouts).toEqual(storedTrackMaps().layouts);
    expect(await maps.assets[0].blob.arrayBuffer()).toEqual(await storedTrackMaps().assets[0].blob.arrayBuffer());
    await restoreFullData(emptyAppData(), { version: 1, tracks: [], layouts: [], visits: [], assets: [] });
    expect(await loadData()).toEqual(emptyAppData());
    expect((await loadTrackMapData()).assets).toEqual([]);
  });

  it.each(["throw", "abort"])("rolls back all five stores after a later map write fails with %s", async (failure) => {
    const original = makeAppData();
    const maps = storedTrackMaps();
    await restoreFullData(original, maps);
    const put = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name !== "trackLayouts") return put.call(this, value, key);
      if (failure === "throw") throw new DOMException("Cannot clone record", "DataCloneError");
      const request = put.call(this, value, key);
      request.addEventListener("success", () => this.transaction.abort());
      return request;
    });
    try {
      const replacement = makeAppData({ events: [makeEvent({ name: "Replacement" })] });
      const replacementMaps = { ...maps, tracks: [{ ...maps.tracks[0], name: "Changed" }] };
      await expect(restoreFullData(replacement, replacementMaps)).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    expect(await loadData()).toEqual(original);
    const reloaded = await loadTrackMapData();
    expect(reloaded.tracks).toEqual(maps.tracks);
    expect(reloaded.layouts).toEqual(maps.layouts);
    expect(reloaded.visits).toEqual(maps.visits);
    expect(await reloaded.assets[0].blob.arrayBuffer()).toEqual(await maps.assets[0].blob.arrayBuffer());
  });
});
