import { beforeEach, describe, expect, it } from "vitest";
import { emptyAppData, loadData, normalizeAppData, openKartDatabase, saveData, validateImport } from "./database";
import { loadTrackMapData, saveTrackMapData } from "./track-map/database";
import { makeAppData, makeTrackMapData } from "./test-fixtures";

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

beforeEach(deleteDatabase);

describe("normalizeAppData", () => {
  it("upgrades a version 1 payload without touching its events", () => {
    const legacy = { ...makeAppData(), version: 1 };
    const normalized = normalizeAppData(legacy);

    expect(normalized?.version).toBe(2);
    expect(normalized?.events).toEqual(legacy.events);
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

describe("persistence round-trip", () => {
  it("stores and reloads app data", async () => {
    const data = makeAppData();
    await saveData(data);
    expect(await loadData()).toEqual(data);
  });

  it("stores and reloads track map records, and the asset box markers are relative to", async () => {
    const data = makeTrackMapData();
    await saveTrackMapData(data);
    const reloaded = await loadTrackMapData();

    expect(reloaded.tracks).toEqual(data.tracks);
    expect(reloaded.layouts).toEqual(data.layouts);
    expect(reloaded.visits).toEqual(data.visits);
    // Image bytes are deliberately not asserted here: fake-indexeddb's structured clone
    // returns a jsdom Blob as a plain {}, so blob persistence cannot be observed in this
    // environment. Byte-exactness is covered by the backup round-trip test, which uses
    // FileReader directly, and by a real browser for the IndexedDB layer itself.
    expect(reloaded.assets[0]).toMatchObject({ id: "asset-1", width: 760, height: 1000, mimeType: "image/webp" });
  });

  it("removes records that were deleted, rather than merging them back", async () => {
    await saveTrackMapData(makeTrackMapData());
    await saveTrackMapData({ ...makeTrackMapData(), tracks: [], layouts: [], visits: [] });
    const reloaded = await loadTrackMapData();

    expect(reloaded.tracks).toEqual([]);
    expect(reloaded.layouts).toEqual([]);
    expect(reloaded.visits).toEqual([]);
  });

  it("keeps app data and track map data in separate stores", async () => {
    await saveData(makeAppData());
    await saveTrackMapData(makeTrackMapData());

    expect((await loadData()).events).toHaveLength(1);
    expect((await loadTrackMapData()).tracks).toHaveLength(1);
  });
});
