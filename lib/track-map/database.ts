import { openKartDatabase } from "@/lib/database";
import { emptyTrackMapData, MapAsset, Track, TrackLayout, TrackMapData, TrackVisit } from "./types";

const TRACKS_STORE = "tracks";
const LAYOUTS_STORE = "trackLayouts";
const VISITS_STORE = "trackVisits";
const ASSETS_STORE = "mapAssets";
let lastAssetSignature = "";

function assetSignature(assets: MapAsset[]) {
  return assets.map((asset) => `${asset.id}:${asset.updatedAt}:${asset.size}`).sort().join("|");
}

function readAll<T>(transaction: IDBTransaction, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function loadTrackMapData(): Promise<TrackMapData> {
  if (typeof indexedDB === "undefined") return emptyTrackMapData();
  const database = await openKartDatabase();
  const transaction = database.transaction([TRACKS_STORE, LAYOUTS_STORE, VISITS_STORE, ASSETS_STORE], "readonly");

  try {
    const [tracks, layouts, visits, assets] = await Promise.all([
      readAll<Track>(transaction, TRACKS_STORE),
      readAll<TrackLayout>(transaction, LAYOUTS_STORE),
      readAll<TrackVisit>(transaction, VISITS_STORE),
      readAll<MapAsset>(transaction, ASSETS_STORE),
    ]);
    lastAssetSignature = assetSignature(assets);
    return { version: 1, tracks, layouts, visits, assets };
  } finally {
    database.close();
  }
}

export async function saveTrackMapData(data: TrackMapData): Promise<void> {
  const database = await openKartDatabase();
  return new Promise((resolve, reject) => {
    const nextAssetSignature = assetSignature(data.assets);
    const assetsChanged = nextAssetSignature !== lastAssetSignature;
    const storeNames = [TRACKS_STORE, LAYOUTS_STORE, VISITS_STORE, ...(assetsChanged ? [ASSETS_STORE] : [])];
    const transaction = database.transaction(storeNames, "readwrite");
    const collections: Array<[string, Array<Track | TrackLayout | TrackVisit | MapAsset>]> = [
      [TRACKS_STORE, data.tracks],
      [LAYOUTS_STORE, data.layouts],
      [VISITS_STORE, data.visits],
      ...(assetsChanged ? [[ASSETS_STORE, data.assets] as [string, MapAsset[]]] : []),
    ];

    for (const [storeName, records] of collections) {
      const store = transaction.objectStore(storeName);
      store.clear();
      records.forEach((record) => store.put(record));
    }

    transaction.oncomplete = () => {
      if (assetsChanged) lastAssetSignature = nextAssetSignature;
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}
