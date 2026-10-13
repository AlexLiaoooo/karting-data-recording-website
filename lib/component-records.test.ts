import { describe, expect, it } from "vitest";
import { createRun, type KartComponent } from "./types";
import { normalizeAppData } from "./database";
import { buildFullBackup, parseFullBackup } from "./track-map/backup";
import { emptyTrackMapData } from "./track-map/types";
import { makeAppData, makeRun } from "./test-fixtures";

const component: KartComponent = { id: "engine-a", name: "Engine A", kind: "Engine", notes: "Practice engine", initialLaps: 100, serviceIntervalLaps: 200, retired: false, services: [{ id: "service-1", date: "2026-10-10", lapsAtService: 80, notes: "Top-end service" }], createdAt: "stamp", updatedAt: "stamp" };
describe("component records and compatible backups", () => {
  it("migrates older backups without inventing installed parts", () => {
    const legacy = { ...makeAppData(), components: undefined }; const restored = normalizeAppData(legacy)!;
    expect(restored.components).toEqual([]); expect(restored.events[0].sessions[0].runs[0].componentIds).toBeUndefined();
  });
  it("retains service history, retired parts and assignments in a backup round trip", async () => {
    const data = makeAppData({ components: [{ ...component, retired: true }] }); data.events[0].sessions[0].runs[0].componentIds = [component.id];
    expect(parseFullBackup(JSON.parse(await buildFullBackup(data, emptyTrackMapData())))!.appData).toEqual(data);
  });
  it("carries installed identities into a copied Run without sharing the array", () => {
    const original = makeRun({ componentIds: [component.id] }); const copy = createRun(2, original);
    expect(copy.componentIds).toEqual([component.id]); copy.componentIds!.push("chain-a"); expect(original.componentIds).toEqual([component.id]);
  });
  it.each([{ initialLaps: -1 }, { initialLaps: 1.2 }, { serviceIntervalLaps: 0 }, { serviceIntervalLaps: "200" }, { kind: "Unknown" }, { retired: 1 }, { name: " " }, { services: [{ id: "s", date: "2026-02-30", lapsAtService: 10, notes: "Service" }] }, { services: [{ id: "s", date: "2026-10-10", lapsAtService: -10, notes: "Service" }] }])("rejects damaged component records: %j", fields => {
    expect(normalizeAppData(makeAppData({ components: [{ ...component, ...fields } as KartComponent] }))).toBeNull();
  });
  it.each([{ ids: ["missing"] }, { ids: [component.id, component.id] }, { ids: [12] }])("rejects missing, duplicate or nonstring Run assignments: %j", ({ ids }) => {
    const data = makeAppData({ components: [component] }); data.events[0].sessions[0].runs[0].componentIds = ids as string[];
    expect(normalizeAppData(data)).toBeNull();
  });
  it("rejects duplicate service IDs and component IDs", () => {
    expect(normalizeAppData(makeAppData({ components: [component, component] }))).toBeNull();
    expect(normalizeAppData(makeAppData({ components: [{ ...component, services: [component.services[0], component.services[0]] }] }))).toBeNull();
  });
});
