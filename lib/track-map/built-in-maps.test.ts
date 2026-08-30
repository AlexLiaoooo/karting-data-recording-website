import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUILT_IN_PFI_CORNERS,
  BUILT_IN_TRACKS,
  createBuiltInTrack,
  loadBuiltInMapAsset,
  refreshBuiltInMaps,
} from "./built-in-maps";
import { makeLayout, makeMapAsset, makeTrack, makeTrackMapData } from "../test-fixtures";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 20 760 1000"><rect/></svg>';
const PFI = BUILT_IN_TRACKS.find((track) => track.key === "pf-international")!;
const WHILTON = BUILT_IN_TRACKS.find((track) => track.key === "whilton-mill")!;
const PFI_LAYOUT = PFI.layouts[0];

function stubFetch(markup: string | null = SVG) {
  vi.stubGlobal("fetch", vi.fn(async () => markup === null
    ? { ok: false, text: async () => "" }
    : { ok: true, text: async () => markup }));
}

afterEach(() => vi.unstubAllGlobals());

describe("loadBuiltInMapAsset", () => {
  it("takes width and height from the file's viewBox, not from a hard-coded pair", async () => {
    stubFetch();
    expect(await loadBuiltInMapAsset(PFI_LAYOUT.mapUrl)).toMatchObject({ width: 760, height: 1000, mimeType: "image/svg+xml" });
  });

  it("rejects a file with no usable viewBox rather than guessing a size", async () => {
    stubFetch('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
    await expect(loadBuiltInMapAsset(PFI_LAYOUT.mapUrl)).rejects.toThrow(/viewBox/);
  });

  it("rejects a missing file", async () => {
    stubFetch(null);
    await expect(loadBuiltInMapAsset(PFI_LAYOUT.mapUrl)).rejects.toThrow(/unavailable/);
  });
});

describe("BUILT_IN_TRACKS", () => {
  const layouts = BUILT_IN_TRACKS.flatMap((track) => track.layouts);

  it("keys every track and layout uniquely, since keys identify stored records", () => {
    expect(new Set(BUILT_IN_TRACKS.map((track) => track.key)).size).toBe(BUILT_IN_TRACKS.length);
    expect(new Set(layouts.map((layout) => layout.key)).size).toBe(layouts.length);
  });

  it("gives each layout its own map file", () => {
    expect(new Set(layouts.map((layout) => layout.mapUrl)).size).toBe(layouts.length);
  });

  it("names layouts uniquely within a track, so the track page can tell them apart", () => {
    for (const track of BUILT_IN_TRACKS) {
      expect(new Set(track.layouts.map((layout) => layout.name)).size, track.name).toBe(track.layouts.length);
    }
  });

  it.each(layouts.map((layout) => [layout.key, layout] as const))("%s numbers corners consecutively in lap order", (_key, layout) => {
    expect(layout.corners.map((corner) => corner.number)).toEqual(layout.corners.map((_, index) => index + 1));
    expect(layout.corners.map((corner) => corner.label)).toEqual(layout.corners.map((_, index) => `T${index + 1}`));
  });

  it.each(layouts.map((layout) => [layout.key, layout] as const))("%s keeps every corner normalised inside the map, like markers", (_key, layout) => {
    for (const corner of layout.corners) {
      expect(corner.x, corner.label).toBeGreaterThan(0);
      expect(corner.x, corner.label).toBeLessThan(1);
      expect(corner.y, corner.label).toBeGreaterThan(0);
      expect(corner.y, corner.label).toBeLessThan(1);
    }
  });

  it.each(layouts.map((layout) => [layout.key, layout] as const))("%s has no two corners on top of each other", (_key, layout) => {
    for (const a of layout.corners) {
      for (const b of layout.corners) {
        if (a.number >= b.number) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.label} vs ${b.label}`).toBeGreaterThan(0.02);
      }
    }
  });

  it("still ships PF International's corner list unchanged", () => {
    expect(PFI_LAYOUT.corners).toBe(BUILT_IN_PFI_CORNERS);
    expect(BUILT_IN_PFI_CORNERS).toHaveLength(15);
  });

  it("offers the Whilton Mill International circuit", () => {
    expect(WHILTON.layouts.map((layout) => layout.name)).toEqual(["International"]);
  });

  /**
   * Twelve, not the eleven curvature detection found on its own: the owner counts the left-hand
   * bend out of the start straight as Turn 1, and it turns 44 degrees where the inherited
   * threshold wanted 55. Asserted so a threshold change cannot quietly renumber the circuit.
   */
  it("numbers Whilton Mill International from the bend out of the start straight", () => {
    const corners = WHILTON.layouts[0].corners;
    expect(corners).toHaveLength(12);
    expect(corners[0]).toMatchObject({ number: 1, label: "T1", x: 0.274, y: 0.4217 });
  });

  /**
   * Kart Silverstone is the one built-in whose layout its source does not establish: OpenStreetMap
   * has no circuit relation and no oneway tagging there. What is known and what is not are drawn
   * differently, and the uncertainty has to reach the user rather than sitting in a code comment.
   */
  describe("Kart Silverstone, which is a reconstruction", () => {
    const silverstone = BUILT_IN_TRACKS.find((track) => track.key === "kart-silverstone")!;
    const markup = () => readFileSync(join(__dirname, "../../public", silverstone.layouts[0].mapUrl), "utf8");

    it("records the anti-clockwise direction the owner confirmed", () => {
      expect(silverstone.direction).toBe("Anti-clockwise");
    });

    it("tells the user in the track notes that the layout is reconstructed", () => {
      expect(silverstone.notes).toMatch(/reconstructed/i);
      expect(silverstone.notes).toMatch(/not a confirmed one/i);
    });

    it("says in the track notes that T1 is where the app starts counting, not the circuit", () => {
      expect(silverstone.notes).toMatch(/not necessarily where the circuit does/i);
    });

    it("draws the direction, which is known", () => {
      expect(markup()).toMatch(/>Direction</);
    });

    /** Nothing in the source marks a start line, so drawing one would invent it. */
    it("draws no start line, which is not known", () => {
      expect(markup()).not.toMatch(/>Start</);
      expect(markup()).toMatch(/no start.finish line/i);
    });

    /**
     * The lap is oriented anti-clockwise before the corners are numbered, so the numbering follows
     * the order a driver meets them. On the canvas, where y grows downward, an anti-clockwise ring
     * has a negative shoelace sum.
     */
    it("draws the lap anti-clockwise, which is what puts the corners in order", () => {
      const path = markup().match(/<path d="([^"]+)" fill="none" stroke="#3b82f6"/)![1];
      const points = [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      const twiceArea = points.slice(1).reduce((total, point, index) => total + (points[index][0] * point[1] - point[0] * points[index][1]), 0);
      expect(twiceArea).toBeLessThan(0);
    });
  });

  /**
   * Buckmore Park is the opposite case to Kart Silverstone: OpenStreetMap maps it as one closed way
   * tagged oneway=yes, so the lap and the direction are both in the data and nothing was chosen.
   * Everything the map asserts should therefore be drawn.
   */
  describe("Buckmore Park, which comes straight from the data", () => {
    const buckmore = BUILT_IN_TRACKS.find((track) => track.key === "buckmore-park")!;
    const markup = () => readFileSync(join(__dirname, "../../public", buckmore.layouts[0].mapUrl), "utf8");

    it("takes its clockwise direction from the oneway tagging", () => {
      expect(buckmore.direction).toBe("Clockwise");
    });

    /** The circuit publishes twelve turns, and the detector finds twelve. */
    it("numbers twelve corners, matching the count the circuit publishes", () => {
      expect(buckmore.layouts[0].corners).toHaveLength(12);
    });

    it("draws both the start line and the direction, since both are known", () => {
      expect(markup()).toMatch(/>Start</);
      expect(markup()).toMatch(/>Direction</);
    });

    it("draws the lap clockwise, which is what puts the corners in order", () => {
      const path = markup().match(/<path d="([^"]+)" fill="none" stroke="#3b82f6"/)![1];
      const points = [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      const twiceArea = points.slice(1).reduce((total, point, index) => total + (points[index][0] * point[1] - point[0] * points[index][1]), 0);
      expect(twiceArea).toBeGreaterThan(0);
    });
  });

  /**
   * Clay Pigeon is the same case as Buckmore Park — one closed way tagged oneway=yes — but with
   * nothing to calibrate the corner count against, because its listings publish eight, nine and
   * twelve for the same layout. The count is asserted together with the note that admits the
   * disagreement, so a threshold change cannot renumber the circuit while leaving the user told
   * the number is settled.
   */
  describe("Clay Pigeon Raceway, whose published corner count is disputed", () => {
    const clay = BUILT_IN_TRACKS.find((track) => track.key === "clay-pigeon")!;
    const markup = () => readFileSync(join(__dirname, "../../public", clay.layouts[0].mapUrl), "utf8");

    it("takes its clockwise direction from the oneway tagging", () => {
      expect(clay.direction).toBe("Clockwise");
    });

    it("numbers the eight corners its own detection finds", () => {
      expect(clay.layouts[0].corners).toHaveLength(8);
    });

    it("tells the user the count is not an official one", () => {
      expect(clay.notes).toMatch(/listings disagree/i);
      expect(clay.notes).toMatch(/not necessarily where the circuit does/i);
    });

    /** 806 m measured against 815 m published is the closest agreement of any built-in map, but it
     *  is still a measured centreline and the note has to say so. */
    it("still calls its length a measured centreline rather than the published one", () => {
      expect(clay.notes).toMatch(/centreline/i);
      expect(markup()).toMatch(/centreline/);
    });

    it("draws the start line, the direction and the pit lane, all three being known", () => {
      expect(markup()).toMatch(/>Start</);
      expect(markup()).toMatch(/>Direction</);
      expect(markup()).toMatch(/>Pit lane</);
    });

    it("draws the lap clockwise, which is what puts the corners in order", () => {
      const path = markup().match(/<path d="([^"]+)" fill="none" stroke="#3b82f6"/)![1];
      const points = [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      const twiceArea = points.slice(1).reduce((total, point, index) => total + (points[index][0] * point[1] - point[0] * points[index][1]), 0);
      expect(twiceArea).toBeGreaterThan(0);
    });
  });

  /**
   * The registry names files under public/; nothing else checks that they are there. A typo or a
   * deleted map would otherwise only surface as a track created with no artwork on a real device.
   */
  it.each(layouts.map((layout) => [layout.key, layout] as const))("%s points at a map file that exists and is sized", (_key, layout) => {
    const path = join(__dirname, "../../public", layout.mapUrl);
    expect(existsSync(path), layout.mapUrl).toBe(true);

    const markup = readFileSync(path, "utf8");
    const viewBox = markup.match(/viewBox\s*=\s*"\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/);
    expect(Number(viewBox?.[1]), `${layout.mapUrl} viewBox width`).toBeGreaterThan(0);
    expect(Number(viewBox?.[2]), `${layout.mapUrl} viewBox height`).toBeGreaterThan(0);
  });

  it("credits OpenStreetMap on every map, which its licence requires", () => {
    for (const layout of layouts) {
      const markup = readFileSync(join(__dirname, "../../public", layout.mapUrl), "utf8");
      expect(markup, layout.mapUrl).toContain("OpenStreetMap contributors");
      expect(markup, layout.mapUrl).toContain("ODbL");
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
    expect(result.layouts[0].builtInMapVersion).toBe(PFI_LAYOUT.version);
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

    expect(result.layouts[0].builtInMapVersion).toBe(PFI_LAYOUT.version);
    expect(result.layouts[0].mapAssetId).not.toBe("asset-1");
    expect(result.assets.map((asset) => asset.id)).not.toContain("asset-1");
    expect(result.assets).toHaveLength(1);
  });

  it("upgrades a layout stamped before versioning existed", async () => {
    stubFetch();
    const data = makeTrackMapData({ ...pfi(), assets: [makeMapAsset()], layouts: [makeLayout({ sourceAttribution: "OSM" })] });

    expect((await refreshBuiltInMaps(data)).layouts[0].builtInMapVersion).toBe(PFI_LAYOUT.version);
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
    const layout = makeLayout({ sourceAttribution: "OSM", builtInMapVersion: PFI_LAYOUT.version });
    const data = makeTrackMapData({ ...pfi(), assets: [makeMapAsset()], layouts: [layout] });

    expect(await refreshBuiltInMaps(data)).toEqual(data);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores layouts belonging to circuits the user built themselves", async () => {
    stubFetch();
    const data = makeTrackMapData({
      tracks: [makeTrack({ name: "Shenington" })],
      layouts: [makeLayout({ mapAssetId: null })],
      visits: [],
      assets: [],
    });

    expect(await refreshBuiltInMaps(data)).toEqual(data);
    expect(fetch).not.toHaveBeenCalled();
  });

  /**
   * A track the user names "Whilton Mill" themselves must not be captured: no stored record can
   * carry a Whilton key without having been created from the registry, so a name match here
   * could only ever overwrite the user's own map.
   */
  it("does not adopt a user-made track that merely shares a built-in name", async () => {
    stubFetch();
    const data = makeTrackMapData({
      tracks: [makeTrack({ name: "Whilton Mill" })],
      layouts: [makeLayout({ name: "International", mapAssetId: null })],
      visits: [],
      assets: [],
    });

    expect(await refreshBuiltInMaps(data)).toEqual(data);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("recognises a keyed layout even after the user renames it", async () => {
    stubFetch();
    const data = makeTrackMapData({
      tracks: [makeTrack({ name: "Whilton" })],
      layouts: [makeLayout({ name: "My favourite loop", builtInLayoutKey: "whilton-international", mapAssetId: null })],
      visits: [],
      assets: [],
    });
    const result = await refreshBuiltInMaps(data);

    expect(result.layouts[0].mapAssetId).toBeTruthy();
    expect(result.layouts[0].corners).toEqual(WHILTON.layouts[0].corners);
  });

  it("fetches once per distinct map when layouts from several circuits are stale", async () => {
    stubFetch();
    const all = BUILT_IN_TRACKS.flatMap((track) => track.layouts);
    const layouts = all.map((layout, index) => makeLayout({
      id: `layout-${index}`,
      name: layout.name,
      builtInLayoutKey: layout.key,
      mapAssetId: null,
      markers: [],
    }));
    const data = makeTrackMapData({ tracks: [makeTrack()], layouts, visits: [], assets: [] });
    const result = await refreshBuiltInMaps(data);

    expect(fetch).toHaveBeenCalledTimes(all.length);
    expect(new Set(result.layouts.map((layout) => layout.mapAssetId)).size).toBe(all.length);
    expect(result.assets).toHaveLength(all.length);
  });

  /**
   * A layout keyed to a circuit that has since been dropped from the registry keeps whatever map
   * it already holds. Falling through to the name match instead could hand it a different
   * circuit's artwork, and clearing it would throw away a map the user may have markers on.
   */
  it("leaves a layout keyed to a circuit no longer in the registry alone", async () => {
    stubFetch();
    const data = makeTrackMapData({
      tracks: [makeTrack({ name: "PF International" })],
      layouts: [makeLayout({ name: "Full Layout", builtInLayoutKey: "whilton-national", sourceAttribution: "OSM" })],
      visits: [],
      assets: [makeMapAsset()],
    });

    expect(await refreshBuiltInMaps(data)).toEqual(data);
    expect(fetch).not.toHaveBeenCalled();
  });

  /**
   * Layouts created before the registry recorded a direction were all stamped Unknown, including
   * the PF International record the app used to create by hand.
   */
  it("fills a direction that was never chosen", async () => {
    stubFetch();
    const data = makeTrackMapData({ ...pfi(), assets: [makeMapAsset()], layouts: [makeLayout({ sourceAttribution: "OSM", direction: "Unknown" })] });

    expect((await refreshBuiltInMaps(data)).layouts[0].direction).toBe("Clockwise");
  });

  it("never overwrites a direction the user picked", async () => {
    stubFetch();
    const data = makeTrackMapData({ ...pfi(), assets: [makeMapAsset()], layouts: [makeLayout({ sourceAttribution: "OSM", direction: "Anti-clockwise" })] });

    expect((await refreshBuiltInMaps(data)).layouts[0].direction).toBe("Anti-clockwise");
  });

  it("keeps marker positions, which are relative to the asset box", async () => {
    stubFetch();
    const data = makeTrackMapData({ ...pfi(), assets: [makeMapAsset()], layouts: [makeLayout({ sourceAttribution: "OSM" })] });
    const before = data.layouts[0].markers.map((marker) => ({ x: marker.x, y: marker.y }));

    const after = (await refreshBuiltInMaps(data)).layouts[0].markers.map((marker) => ({ x: marker.x, y: marker.y }));
    expect(after).toEqual(before);
  });
});

describe("createBuiltInTrack", () => {
  const STAMP = "2026-08-19T09:00:00.000Z";

  it.each(BUILT_IN_TRACKS.map((track) => [track.key, track] as const))("%s creates one layout per circuit, each keyed and carrying its own map", async (_key, track) => {
    stubFetch();
    const created = await createBuiltInTrack(track, STAMP);

    expect(created.track).toMatchObject({ name: track.name, location: track.location, createdAt: STAMP });
    expect(created.layouts.map((layout) => layout.name)).toEqual(track.layouts.map((layout) => layout.name));
    expect(created.layouts.map((layout) => layout.builtInLayoutKey)).toEqual(track.layouts.map((layout) => layout.key));
    expect(created.layouts.every((layout) => layout.mapAssetId)).toBe(true);
    expect(created.layouts.every((candidate) => candidate.trackId === created.track.id)).toBe(true);
    expect(created.assets).toHaveLength(track.layouts.length);
    expect(created.mapsLoaded).toBe(track.layouts.length);
  });

  it("records the direction taken from the circuit geometry rather than leaving it unknown", async () => {
    stubFetch();
    const created = await createBuiltInTrack(WHILTON, STAMP);

    expect(created.layouts.every((layout) => layout.direction === "Clockwise")).toBe(true);
  });

  it("still creates the track when the artwork cannot be fetched", async () => {
    stubFetch(null);
    const created = await createBuiltInTrack(WHILTON, STAMP);

    expect(created.mapsLoaded).toBe(0);
    expect(created.assets).toHaveLength(0);
    expect(created.layouts.every((layout) => layout.mapAssetId === null)).toBe(true);
    // Keys and corners survive, so refreshBuiltInMaps attaches the maps on a later load.
    expect(created.layouts.every((layout) => layout.builtInLayoutKey)).toBe(true);
    expect(created.layouts[0].corners).toEqual(WHILTON.layouts[0].corners);
  });

  it("gives every record a distinct id", async () => {
    stubFetch();
    const created = await createBuiltInTrack(WHILTON, STAMP);
    const ids = [created.track.id, ...created.layouts.map((layout) => layout.id), ...created.assets.map((asset) => asset.id)];

    expect(new Set(ids).size).toBe(ids.length);
  });
});
