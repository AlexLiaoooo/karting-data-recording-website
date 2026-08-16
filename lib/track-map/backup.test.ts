import { describe, expect, it } from "vitest";
import { buildFullBackup, parseFullBackup } from "./backup";
import { blobBytes as bytes, makeAppData, makeMapAsset, makeTrackMapData } from "../test-fixtures";

async function roundTrip() {
  const appData = makeAppData();
  const trackMapData = makeTrackMapData();
  const restored = parseFullBackup(JSON.parse(await buildFullBackup(appData, trackMapData)));
  if (!restored) throw new Error("Backup failed to parse");
  return { appData, trackMapData, restored };
}

describe("full backup round-trip", () => {
  it("restores events, sessions and runs unchanged", async () => {
    const { appData, restored } = await roundTrip();
    expect(restored.appData).toEqual(appData);
  });

  it("restores tracks, layouts, markers and visits unchanged", async () => {
    const { trackMapData, restored } = await roundTrip();

    expect(restored.trackMapData.tracks).toEqual(trackMapData.tracks);
    expect(restored.trackMapData.layouts).toEqual(trackMapData.layouts);
    expect(restored.trackMapData.visits).toEqual(trackMapData.visits);
  });

  it("restores map image bytes exactly", async () => {
    const original = makeMapAsset();
    const restored = parseFullBackup(JSON.parse(await buildFullBackup(makeAppData(), makeTrackMapData({ assets: [original] }))));

    const asset = restored?.trackMapData.assets[0];
    expect(asset).toBeDefined();
    expect(await bytes(asset!.blob)).toEqual(await bytes(original.blob));
    expect(asset!.size).toBe(original.size);
    expect(asset!.mimeType).toBe(original.mimeType);
  });

  it("preserves the asset dimensions that marker positions are relative to", async () => {
    const { restored } = await roundTrip();
    expect(restored.trackMapData.assets[0]).toMatchObject({ width: 760, height: 1000 });
  });

  it("keeps marker coordinates normalised between 0 and 1", async () => {
    const { restored } = await roundTrip();

    for (const marker of restored.trackMapData.layouts.flatMap((layout) => layout.markers)) {
      expect(marker.x).toBeGreaterThanOrEqual(0);
      expect(marker.x).toBeLessThanOrEqual(1);
      expect(marker.y).toBeGreaterThanOrEqual(0);
      expect(marker.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("parseFullBackup", () => {
  it("accepts a legacy backup that predates Track Maps", () => {
    const restored = parseFullBackup(makeAppData());

    expect(restored?.appData.events).toHaveLength(1);
    expect(restored?.trackMapData).toEqual({ version: 1, tracks: [], layouts: [], visits: [], assets: [] });
  });

  it("upgrades a version 1 payload to version 2", () => {
    expect(parseFullBackup({ ...makeAppData(), version: 1 })?.appData.version).toBe(2);
  });

  it.each([
    ["not an object", "nonsense"],
    ["null", null],
    ["an unrelated JSON document", { hello: "world" }],
    ["a backup with a corrupt map image", { kind: "kart-data-full-backup", version: 3, exportedAt: "", appData: makeAppData(), trackMap: { version: 1, tracks: [], layouts: [], visits: [], assets: [{ id: "a", dataUrl: "not-a-data-url", width: 1, height: 1, mimeType: "image/webp", size: 1, updatedAt: "" }] } }],
  ])("rejects %s", (_label, value) => {
    expect(parseFullBackup(value)).toBeNull();
  });
});
