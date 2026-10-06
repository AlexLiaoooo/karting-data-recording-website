import type { AppData } from "@/lib/types";
import { normalizeAppData } from "@/lib/database";
import { migrateMarkerTypes } from "./database";
import { emptyTrackMapData, MapAsset, TrackMapData } from "./types";
import { validPortableTrackMap } from "../validation";

type PortableMapAsset = Omit<MapAsset, "blob"> & { dataUrl: string };

type FullBackup = {
  kind: "kart-data-full-backup";
  version: 3;
  exportedAt: string;
  appData: AppData;
  trackMap: Omit<TrackMapData, "assets"> & { assets: PortableMapAsset[] };
};

export type ParsedBackup = {
  appData: AppData;
  trackMapData: TrackMapData;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]+={0,2})$/i);
  if (!match) throw new Error("Invalid map image in backup.");
  const [, mimeType, encoded] = match;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

export async function buildFullBackup(appData: AppData, trackMapData: TrackMapData): Promise<string> {
  const assets = await Promise.all(trackMapData.assets.map(async ({ blob, ...asset }) => ({
    ...asset,
    dataUrl: await blobToDataUrl(blob),
  })));
  const backup: FullBackup = {
    kind: "kart-data-full-backup",
    version: 3,
    exportedAt: new Date().toISOString(),
    appData,
    trackMap: { ...trackMapData, assets },
  };
  return JSON.stringify(backup, null, 2);
}

export function parseFullBackup(value: unknown): ParsedBackup | null {
  const legacy = normalizeAppData(value);
  if (legacy) return { appData: legacy, trackMapData: emptyTrackMapData() };
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<FullBackup>;
  if (candidate.kind !== "kart-data-full-backup" || candidate.version !== 3) return null;
  const appData = normalizeAppData(candidate.appData);
  const trackMap = candidate.trackMap;
  if (!appData || !trackMap || !validPortableTrackMap(trackMap)) return null;

  try {
    const assets = trackMap.assets.map((asset) => {
      if (!asset || typeof asset !== "object" || typeof asset.id !== "string" || typeof asset.dataUrl !== "string") {
        throw new Error("Invalid map asset");
      }
      const blob = dataUrlToBlob(asset.dataUrl);
      if (blob.type !== asset.mimeType.toLowerCase()) throw new Error("Map image type does not match its metadata");
      return {
        id: asset.id,
        blob,
        width: asset.width,
        height: asset.height,
        mimeType: blob.type,
        size: blob.size,
        updatedAt: asset.updatedAt,
      };
    });
    return {
      appData,
      trackMapData: {
        version: 1,
        tracks: trackMap.tracks,
        // A backup taken before the marker types were reduced restores through the same
        // migration as stored data, so an old export stays usable.
        layouts: migrateMarkerTypes(trackMap.layouts),
        visits: trackMap.visits,
        assets,
      },
    };
  } catch {
    return null;
  }
}
