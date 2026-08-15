import type { AppData } from "@/lib/types";
import { normalizeAppData } from "@/lib/database";
import { emptyTrackMapData, MapAsset, TrackMapData } from "./types";

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
  const [header, encoded] = dataUrl.split(",", 2);
  if (!header || !encoded || !header.startsWith("data:")) throw new Error("Invalid map image in backup.");
  const mimeType = header.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
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
  if (!appData || !trackMap || trackMap.version !== 1 || !Array.isArray(trackMap.tracks)
    || !Array.isArray(trackMap.layouts) || !Array.isArray(trackMap.visits) || !Array.isArray(trackMap.assets)) return null;

  try {
    const assets = trackMap.assets.map((asset) => {
      if (!asset || typeof asset !== "object" || typeof asset.id !== "string" || typeof asset.dataUrl !== "string") {
        throw new Error("Invalid map asset");
      }
      const blob = dataUrlToBlob(asset.dataUrl);
      return {
        id: asset.id,
        blob,
        width: Number(asset.width) || 1,
        height: Number(asset.height) || 1,
        mimeType: typeof asset.mimeType === "string" ? asset.mimeType : blob.type,
        size: blob.size,
        updatedAt: typeof asset.updatedAt === "string" ? asset.updatedAt : new Date().toISOString(),
      };
    });
    return {
      appData,
      trackMapData: {
        version: 1,
        tracks: trackMap.tracks,
        layouts: trackMap.layouts,
        visits: trackMap.visits,
        assets,
      },
    };
  } catch {
    return null;
  }
}
