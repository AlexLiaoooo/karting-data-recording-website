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
  const invalidFields: Array<[string, (string | number)[], unknown]> = [
    ["a missing session collection", ["appData", "events", 0, "sessions"], undefined],
    ["a null session", ["appData", "events", 0, "sessions", 0], null],
    ["an invalid calendar date", ["appData", "events", 0, "startDate"], "2026-02-30"],
    ["a numeric tyre reading", ["appData", "events", 0, "sessions", 0, "runs", 0, "tyres", "fl", "coldPressure"], 12],
    ["a missing setup", ["appData", "events", 0, "sessions", 0, "runs", 0, "setup"], {}],
    ["an invalid run number", ["appData", "events", 0, "sessions", 0, "runs", 0, "number"], 0],
    ["an invalid balance", ["appData", "events", 0, "sessions", 0, "runs", 0, "balance"], "unknown"],
    ["an empty record ID", ["appData", "events", 0, "id"], ""],
    ["null templates", ["appData", "setupTemplates"], null],
    ["a null track", ["trackMap", "tracks", 0], null],
    ["an unknown owning track", ["trackMap", "layouts", 0, "trackId"], "missing"],
    ["a missing map asset", ["trackMap", "layouts", 0, "mapAssetId"], "missing"],
    ["a marker outside its map", ["trackMap", "layouts", 0, "markers", 0, "x"], 1.1],
    ["an invalid marker type", ["trackMap", "layouts", 0, "markers", 0, "type"], "unknown"],
    ["an invalid tag", ["trackMap", "layouts", 0, "markers", 0, "tags"], [12]],
    ["an invalid corner", ["trackMap", "layouts", 0, "corners"], [{ number: 1, label: "T1", x: -1, y: 0 }]],
    ["an invalid observation", ["trackMap", "visits", 0, "observations", 0, "result"], "unknown"],
    ["an inconsistent observation session", ["trackMap", "visits", 0, "observations", 0, "sessionId"], "different"],
    ["a zero image width", ["trackMap", "assets", 0, "width"], 0],
    ["a fractional image height", ["trackMap", "assets", 0, "height"], 1.5],
    ["a mismatched image type", ["trackMap", "assets", 0, "mimeType"], "image/png"],
  ];

  it.each(invalidFields)("rejects %s before restoring any records", async (_label, path, value) => {
    const payload = JSON.parse(await buildFullBackup(makeAppData(), makeTrackMapData()));
    let parent: Record<string | number, unknown> = payload;
    for (const key of path.slice(0, -1)) parent = parent[key] as Record<string | number, unknown>;
    parent[path.at(-1)!] = value;
    expect(parseFullBackup(payload)).toBeNull();
  });

  it("rejects duplicate IDs rather than silently dropping a record during restore", async () => {
    const payload = JSON.parse(await buildFullBackup(makeAppData(), makeTrackMapData()));
    payload.trackMap.tracks.push({ ...payload.trackMap.tracks[0], name: "Another track" });
    expect(parseFullBackup(payload)).toBeNull();
  });

  it("keeps historical observations whose Event has since been deleted", async () => {
    const payload = await buildFullBackup(makeAppData({ events: [], lastEventId: null }), makeTrackMapData());
    expect(parseFullBackup(JSON.parse(payload))?.trackMapData.visits[0].observations).toHaveLength(1);
  });

  it("migrates legacy marker types without losing the original note", async () => {
    const payload = JSON.parse(await buildFullBackup(makeAppData(), makeTrackMapData()));
    payload.trackMap.layouts[0].markers[0].type = "Hazard";
    expect(parseFullBackup(payload)?.trackMapData.layouts[0].markers[0]).toMatchObject({
      type: "Others", generalNote: expect.stringContaining("Previously marked as Hazard."),
    });
  });

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
