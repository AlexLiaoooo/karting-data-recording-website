import { describe, expect, it } from "vitest";
import { buildFullBackup, parseFullBackup } from "./track-map/backup";
import { emptyTrackMapData } from "./track-map/types";
import { normalizeAppData } from "./database";
import { createRun, type TyreSet } from "./types";
import { lapCount, tyreRunHistory, tyreSetSummary, tyreUsageByRun } from "./tyre-sets";
import { makeAppData, makeEvent, makeRun, makeSession } from "./test-fixtures";

export const testTyreSet: TyreSet = { id: "set-1", name: "Dry A", compound: "Medium", notes: "", initialLaps: 20, initialHeatCycles: 2, retired: false, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" };
const records = () => makeAppData({ tyreSets: [testTyreSet], events: [makeEvent({ sessions: [makeSession({ runs: [
  makeRun({ id: "first", number: 1, tyreSetId: "set-1", tyreHeatCycle: true, laps: "12" }),
  makeRun({ id: "pending", number: 2, tyreSetId: "set-1", tyreHeatCycle: true, laps: "99", completed: false }),
  makeRun({ id: "last", number: 3, tyreSetId: "set-1", laps: "8" }),
  makeRun({ id: "unassigned", number: 4, laps: "100" }),
] })] })] });

describe("tyre-set usage", () => {
  it("counts only completed assigned Runs and explicitly recorded cycles", () => {
    expect(tyreSetSummary(records(), testTyreSet)).toEqual({ laps: 40, heatCycles: 3, completedRuns: 2, missingLaps: 0 });
  });
  it("snapshots age before each Run without counting that Run", () => {
    const ages = tyreUsageByRun(records());
    expect(ages.get("first")?.laps).toBe(20);
    expect(ages.get("pending")?.laps).toBe(32);
    expect(ages.get("last")).toEqual({ laps: 32, heatCycles: 3, completedRuns: 1, missingLaps: 0 });
    expect(ages.has("unassigned")).toBe(false);
  });
  it("orders by visit date and Run number, not array order, without mutating data", () => {
    const data = records();
    data.events[0].sessions[0].runs.reverse();
    const earlier = makeEvent({ id: "earlier", startDate: "2026-07-01", sessions: [makeSession({ id: "earlier-session", runs: [makeRun({ id: "earlier-run", tyreSetId: "set-1", laps: "5" })] })] });
    data.events.push(earlier);
    const original = JSON.stringify(data);
    expect(tyreRunHistory(data)[0].run.id).toBe("earlier-run");
    expect(tyreUsageByRun(data).get("first")?.laps).toBe(25);
    expect(JSON.stringify(data)).toBe(original);
  });
  it("flags missing/invalid laps instead of guessing, and recalculates corrections/deletions", () => {
    const data = records();
    data.events[0].sessions[0].runs[0].laps = "12.5";
    expect(tyreSetSummary(data, testTyreSet)).toMatchObject({ laps: 28, missingLaps: 1 });
    data.events[0].sessions[0].runs.splice(0, 1);
    expect(tyreSetSummary(data, testTyreSet)).toMatchObject({ laps: 28, heatCycles: 2 });
  });
  it("does not wrap safe integer totals", () => {
    expect(tyreSetSummary(records(), { ...testTyreSet, initialLaps: Number.MAX_SAFE_INTEGER }).laps).toBeNull();
  });
  it.each(["", "-1", "1.5", "abc", "1e3", "9007199254740992"])("refuses unknown or invalid lap count %s", value => {
    expect(lapCount(value)).toBeNull();
  });
  it("accepts zero and whitespace around whole laps", () => {
    expect(lapCount(" 12 ")).toBe(12);
    expect(lapCount("0")).toBe(0);
  });
  it("copies set identity while resetting the recorded cycle", () => {
    const copy = createRun(2, records().events[0].sessions[0].runs[0]);
    expect(copy.tyreSetId).toBe("set-1");
    expect(copy.tyreHeatCycle).toBe(false);
    expect(copy.completed).toBe(false);
  });
  it("preserves retired sets, assignments, cycles and starting usage through a full backup", async () => {
    const data = records();
    data.tyreSets[0] = { ...testTyreSet, retired: true };
    const restored = parseFullBackup(JSON.parse(await buildFullBackup(data, emptyTrackMapData())));
    expect(restored?.appData).toEqual(data);
  });
  it("defaults legacy backups to no tyre sets without assigning old Runs", () => {
    const legacy: Record<string, unknown> = { ...makeAppData() };
    delete legacy.tyreSets;
    expect(normalizeAppData(legacy)?.tyreSets).toEqual([]);
    expect(normalizeAppData(legacy)?.events[0].sessions[0].runs[0].tyreSetId).toBeUndefined();
  });
  it.each([null, [{ ...testTyreSet, initialLaps: -1 }], [{ ...testTyreSet, initialHeatCycles: 1.5 }], [{ ...testTyreSet, retired: "yes" }], [testTyreSet, testTyreSet]])("rejects malformed set collections %j", tyreSets => {
    expect(normalizeAppData({ ...records(), tyreSets })).toBeNull();
  });
  it("rejects unknown assignments and a cycle without an assigned set", () => {
    const data = records();
    data.events[0].sessions[0].runs[0].tyreSetId = "missing";
    expect(normalizeAppData(data)).toBeNull();
    data.events[0].sessions[0].runs[0].tyreSetId = null;
    expect(normalizeAppData(data)).toBeNull();
  });
});
