import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_PFI_CORNERS, BUILT_IN_PFI_MAP_VERSION, loadBuiltInMapAsset, refreshBuiltInMaps } from "./built-in-map";
import { makeLayout, makeMapAsset, makeTrack, makeTrackMapData } from "../test-fixtures";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 20 760 1000"><rect/></svg>';

function stubFetch(markup: string | null = SVG) {
  vi.stubGlobal("fetch", vi.fn(async () => markup === null
    ? { ok: false, text: async () => "" }
    : { ok: true, text: async () => markup }));
}

afterEach(() => vi.unstubAllGlobals());

describe("loadBuiltInMapAsset", () => {
  it("takes width and height from the file's viewBox, not from a hard-coded pair", async () => {
    stubFetch();
    expect(await loadBuiltInMapAsset()).toMatchObject({ width: 760, height: 1000, mimeType: "image/svg+xml" });
  });

  it("rejects a file with no usable viewBox rather than guessing a size", async () => {
    stubFetch('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
    await expect(loadBuiltInMapAsset()).rejects.toThrow(/viewBox/);
  });

  it("rejects a missing file", async () => {
    stubFetch(null);
    await expect(loadBuiltInMapAsset()).rejects.toThrow(/unavailable/);
  });
});

describe("BUILT_IN_PFI_CORNERS", () => {
  it("numbers corners consecutively in lap order", () => {
    expect(BUILT_IN_PFI_CORNERS.map((corner) => corner.number)).toEqual(BUILT_IN_PFI_CORNERS.map((_, index) => index + 1));
    expect(BUILT_IN_PFI_CORNERS.map((corner) => corner.label)).toEqual(BUILT_IN_PFI_CORNERS.map((_, index) => `T${index + 1}`));
  });

  it("keeps every corner normalised inside the map, like markers", () => {
    for (const corner of BUILT_IN_PFI_CORNERS) {
      expect(corner.x, corner.label).toBeGreaterThan(0);
      expect(corner.x, corner.label).toBeLessThan(1);
      expect(corner.y, corner.label).toBeGreaterThan(0);
      expect(corner.y, corner.label).toBeLessThan(1);
    }
  });

  it("has no two corners on top of each other", () => {
    for (const a of BUILT_IN_PFI_CORNERS) {
      for (const b of BUILT_IN_PFI_CORNERS) {
        if (a.number >= b.number) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.label} vs ${b.label}`).toBeGreaterThan(0.02);
      }
    }
  });
});

describe("refreshBuiltInMaps", () => {
  const pfi = () => ({ tracks: [makeTrack()], visits: [], assets: [] });

  it("attaches the map to a PF International layout that has none", async () => {
    stubFetch();
    const data = makeTrackMapData({ ...pfi(), layouts: [makeLayout({ mapAssetId: null, markers: [] })] });
    const result = await refreshBuiltInMaps(data);

    expect(result.layouts[0].mapAssetId).toBeTruthy();
    expect(result.layouts[0].builtInMapVersion).toBe(BUILT_IN_PFI_MAP_VERSION);
    expect(result.assets).toHaveLength(1);
  });

  it("replaces artwork that is still on an older version", async () => {
    stubFetch();
    const data = makeTrackMapData({
      ...pfi(),
      assets: [makeMapAsset()],
      layouts: [makeLayout({ sourceAttribution: "OSM", builtInMapVersion: "an-older-version" })],
    });
    const result = await refreshBuiltInMaps(data);

    expect(result.layouts[0].builtInMapVersion).toBe(BUILT_IN_PFI_MAP_VERSION);
    expect(result.layouts[0].mapAssetId).not.toBe("asset-1");
    expect(result.assets.map((asset) => asset.id)).not.toContain("asset-1");
    expect(result.assets).toHaveLength(1);
  });

  it("upgrades a layout stamped before versioning existed", async () => {
    stubFetch();
    const data = makeTrackMapData({ ...pfi(), assets: [makeMapAsset()], layouts: [makeLayout({ sourceAttribution: "OSM" })] });

    expect((await refreshBuiltInMaps(data)).layouts[0].builtInMapVersion).toBe(BUILT_IN_PFI_MAP_VERSION);
  });

  it("backfills corner labels onto a layout that predates them", async () => {
    stubFetch();
    const data = makeTrackMapData({ ...pfi(), assets: [makeMapAsset()], layouts: [makeLayout({ sourceAttribution: "OSM", corners: undefined })] });

    expect((await refreshBuiltInMaps(data)).layouts[0].corners).toEqual(BUILT_IN_PFI_CORNERS);
  });

  it("never touches a map the user uploaded", async () => {
    stubFetch();
    // uploadImage clears sourceAttribution, which is what marks a map as user-owned.
    const layout = makeLayout({ sourceAttribution: undefined, sourceUrl: undefined, builtInMapVersion: undefined });
    const data = makeTrackMapData({ ...pfi(), assets: [makeMapAsset()], layouts: [layout] });

    expect(await refreshBuiltInMaps(data)).toEqual(data);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("leaves data untouched when the map is already current", async () => {
    stubFetch();
    const layout = makeLayout({ sourceAttribution: "OSM", builtInMapVersion: BUILT_IN_PFI_MAP_VERSION });
    const data = makeTrackMapData({ ...pfi(), assets: [makeMapAsset()], layouts: [layout] });

    expect(await refreshBuiltInMaps(data)).toEqual(data);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores layouts belonging to other circuits", async () => {
    stubFetch();
    const data = makeTrackMapData({
      tracks: [makeTrack({ name: "Whilton Mill" })],
      layouts: [makeLayout({ mapAssetId: null })],
      visits: [],
      assets: [],
    });

    expect(await refreshBuiltInMaps(data)).toEqual(data);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps marker positions, which are relative to the asset box", async () => {
    stubFetch();
    const data = makeTrackMapData({ ...pfi(), assets: [makeMapAsset()], layouts: [makeLayout({ sourceAttribution: "OSM" })] });
    const before = data.layouts[0].markers.map((marker) => ({ x: marker.x, y: marker.y }));

    const after = (await refreshBuiltInMaps(data)).layouts[0].markers.map((marker) => ({ x: marker.x, y: marker.y }));
    expect(after).toEqual(before);
  });
});
