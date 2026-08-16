import type { MapAsset, TrackCorner, TrackLayout, TrackMapData } from "./types";

// Derived by scripts/derive-corners.mjs from the shipped SVG's own path geometry. Re-run that
// script if the artwork changes; do not hand-edit. Lap order starts at the Sector 1 line.
export const BUILT_IN_PFI_CORNERS: TrackCorner[] = [
  { number: 1, label: "T1", x: 0.0808, y: 0.7548 },
  { number: 2, label: "T2", x: 0.3283, y: 0.6857 },
  { number: 3, label: "T3", x: 0.1478, y: 0.6519 },
  { number: 4, label: "T4", x: 0.4859, y: 0.3213 },
  { number: 5, label: "T5", x: 0.3403, y: 0.5312 },
  { number: 6, label: "T6", x: 0.5839, y: 0.3177 },
  { number: 7, label: "T7", x: 0.4791, y: 0.2749 },
  { number: 8, label: "T8", x: 0.645, y: 0.0836 },
  { number: 9, label: "T9", x: 0.8326, y: 0.147 },
  { number: 10, label: "T10", x: 0.6883, y: 0.1238 },
  { number: 11, label: "T11", x: 0.6034, y: 0.2136 },
  { number: 12, label: "T12", x: 0.7161, y: 0.2653 },
];

export const BUILT_IN_PFI_MAP_URL = "/maps/pfi-international-owner-driver.svg";
export const BUILT_IN_PFI_ATTRIBUTION = "Geometry derived from OpenStreetMap contributors · ODbL 1.0";
export const BUILT_IN_PFI_SOURCE_URL = "https://www.openstreetmap.org/copyright";

/**
 * Bump whenever the shipped SVG changes. The artwork is copied into IndexedDB the first
 * time a track uses it, so without a version stamp a corrected map never reaches a device
 * that already stored the old one.
 */
export const BUILT_IN_PFI_MAP_VERSION = "2026-08-16-corner-labels";

/**
 * Loads a map that ships with the app. Width and height come from the file's own viewBox
 * rather than being hard-coded at the call site: marker positions are stored as fractions
 * of the asset box, so a stored size that disagrees with the artwork letterboxes the image
 * and drifts every marker placed on it.
 */
export async function loadBuiltInMapAsset(url = BUILT_IN_PFI_MAP_URL): Promise<MapAsset> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Built-in map unavailable.");
  const markup = await response.text();

  const viewBox = markup.match(/viewBox\s*=\s*"\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/);
  const width = Number(viewBox?.[1]);
  const height = Number(viewBox?.[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Built-in map has no usable viewBox.");
  }

  const blob = new Blob([markup], { type: "image/svg+xml" });
  return {
    id: crypto.randomUUID(),
    blob,
    width,
    height,
    mimeType: "image/svg+xml",
    size: blob.size,
    updatedAt: new Date().toISOString(),
  };
}

export function builtInPfiLayoutFields(asset: MapAsset) {
  return {
    mapAssetId: asset.id,
    sourceAttribution: BUILT_IN_PFI_ATTRIBUTION,
    sourceUrl: BUILT_IN_PFI_SOURCE_URL,
    builtInMapVersion: BUILT_IN_PFI_MAP_VERSION,
    corners: BUILT_IN_PFI_CORNERS,
  };
}

function isPfiFullLayout(data: TrackMapData, layout: TrackLayout) {
  const track = data.tracks.find((candidate) => candidate.id === layout.trackId);
  return track?.name.trim().toLowerCase() === "pf international" && layout.name.trim().toLowerCase() === "full layout";
}

/**
 * Attaches the built-in PF International map to layouts that need it, and replaces it on
 * layouts still holding an older version of the artwork.
 *
 * A layout whose map the user replaced has no `sourceAttribution` (uploadImage clears it),
 * which is what marks it as user-owned and off-limits here. Returns the input unchanged
 * when there is nothing to do, so callers can assign the result unconditionally.
 */
export async function refreshBuiltInMaps(data: TrackMapData): Promise<TrackMapData> {
  const stale = data.layouts.filter((layout) => {
    if (!isPfiFullLayout(data, layout)) return false;
    const carriesBuiltInMap = !layout.mapAssetId || Boolean(layout.sourceAttribution);
    return carriesBuiltInMap && layout.builtInMapVersion !== BUILT_IN_PFI_MAP_VERSION;
  });
  if (!stale.length) return data;

  const asset = await loadBuiltInMapAsset();
  const staleIds = new Set(stale.map((layout) => layout.id));
  const replacedAssetIds = new Set(stale.map((layout) => layout.mapAssetId).filter((id): id is string => Boolean(id)));
  const timestamp = new Date().toISOString();

  return {
    ...data,
    assets: [...data.assets.filter((candidate) => !replacedAssetIds.has(candidate.id)), asset],
    layouts: data.layouts.map((layout) => layout.id && staleIds.has(layout.id)
      ? { ...layout, ...builtInPfiLayoutFields(asset), updatedAt: timestamp }
      : layout),
  };
}
