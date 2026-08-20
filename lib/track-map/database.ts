import { openKartDatabase } from "@/lib/database";
import { emptyTrackMapData, legacyMarkerTypes, MapAsset, Track, TrackLayout, TrackMapData, TrackVisit } from "./types";

/**
 * Distance, in normalised map units, within which a marker counts as sitting on a corner.
 * Placing on a corner copies its exact position, so this only has to absorb rounding. Corner
 * lists are checked to keep corners at least 0.02 apart, so nothing here is ambiguous.
 */
const ON_CORNER = 0.002;

/** A label the app wrote from a corner, rather than one the user typed. */
const DERIVED_LABEL = /^T\d+$/;

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

/**
 * Rewrites markers stored under the old, longer type list. Types that were phases of a
 * corner map straight across; the rest had no equivalent, so they become "Mid" and their
 * original type is written into the general note rather than being lost.
 */
export function migrateMarkerTypes(layouts: TrackLayout[]): TrackLayout[] {
  return layouts.map((layout) => {
    let changed = false;
    const markers = layout.markers.map((marker) => {
      const legacy = legacyMarkerTypes[marker.type];
      if (!legacy) return marker;
      changed = true;
      const generalNote = legacy.keepsMeaning
        ? marker.generalNote
        : [`Previously marked as ${marker.type}.`, marker.generalNote].filter(Boolean).join("\n");
      return { ...marker, type: legacy.type, generalNote };
    });
    return changed ? { ...layout, markers } : layout;
  });
}

/**
 * Links markers that were placed on a corner back to that corner, for records written before
 * markers stored a corner number and only carried a copy of its text.
 *
 * Matching is on position, never on the label: after a renumber the stored text names a corner
 * the marker is no longer on, so trusting it would re-attach the marker to the wrong one. A
 * label the app generated is cleared once the link exists, which is what lets it follow a
 * renumber; a label the user typed is left alone and keeps precedence.
 *
 * Must run after refreshBuiltInMaps, so the corner list it matches against is the current one.
 */
export function attachMarkersToCorners(data: TrackMapData): TrackMapData {
  let changed = false;

  const layouts = data.layouts.map((layout) => {
    const corners = layout.corners;
    if (!corners?.length) return layout;

    let layoutChanged = false;
    const markers = layout.markers.map((marker) => {
      if (marker.cornerNumber !== undefined) return marker;
      const corner = corners.find((candidate) => Math.hypot(candidate.x - marker.x, candidate.y - marker.y) <= ON_CORNER);
      if (!corner) return marker;

      layoutChanged = true;
      return {
        ...marker,
        cornerNumber: corner.number,
        label: DERIVED_LABEL.test(marker.label) ? "" : marker.label,
      };
    });

    if (!layoutChanged) return layout;
    changed = true;
    return { ...layout, markers };
  });

  return changed ? { ...data, layouts } : data;
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
    return { version: 1, tracks, layouts: migrateMarkerTypes(layouts), visits, assets };
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
