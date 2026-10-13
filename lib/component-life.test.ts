import { describe, expect, it } from "vitest";
import { componentUsage } from "./component-life";
import type { KartComponent, RunRecord } from "./types";
import { makeAppData, makeEvent, makeRun, makeSession } from "./test-fixtures";
const component: KartComponent = { id: "engine-a", name: "Engine A", kind: "Engine", notes: "", initialLaps: 100, serviceIntervalLaps: 40, services: [{ id: "s", date: "2026-10-10", lapsAtService: 80, notes: "Rebuild" }], retired: false, createdAt: "stamp", updatedAt: "stamp" };
const data = (...runs: RunRecord[]) => makeAppData({ components: [component], events: [makeEvent({ sessions: [makeSession({ runs })] })] });
const run = (fields: Partial<RunRecord> = {}) => makeRun({ componentIds: [component.id], laps: "12", ...fields });
describe("component usage and service reminders", () => {
  it("adds completed assigned Runs across Events to starting usage", () => {
    const records = data(run(), run({ id: "unfinished", completed: false }), run({ id: "different", componentIds: [] }));
    records.events.push(makeEvent({ id: "earlier", sessions: [makeSession({ id: "other-session", runs: [run({ id: "other-run", laps: "10" })] })] }));
    expect(componentUsage(records, component)).toMatchObject({ totalLaps: 122, completedRuns: 2, sinceService: 42, remainingLaps: 0, state: "due" });
  });
  it.each([{ laps: "15", state: "ok" }, { laps: "16", state: "soon" }, { laps: "20", state: "due" }])("uses a 10-percent near-due window: %j", ({ laps, state }) => {
    expect(componentUsage(data(run({ laps })), component).state).toBe(state);
  });
  it.each(["", "bad", "12.5", "-1", "1e2"])("keeps unknown laps incomplete: %s", laps => {
    const usage = componentUsage(data(run({ laps })), component);
    expect(usage).toMatchObject({ totalLaps: 100, missingLaps: 1, state: "incomplete" });
  });
  it("accepts zero recorded laps and does not invent service intervals", () => {
    expect(componentUsage(data(run({ laps: "0" })), { ...component, serviceIntervalLaps: null })).toMatchObject({ totalLaps: 100, missingLaps: 0, state: "none", remainingLaps: null });
  });
  it("remains due if known laps already exceed the interval despite missing Runs", () => {
    expect(componentUsage(data(run({ laps: "30" }), run({ id: "unknown", laps: "" })), component)).toMatchObject({ state: "due", missingLaps: 1 });
  });
  it("uses the highest service counter even if entries arrive out of date order", () => {
    expect(componentUsage(data(run()), { ...component, services: [...component.services, { id: "older", date: "2026-10-01", lapsAtService: 110, notes: "Late entry" }] })).toMatchObject({ serviceLaps: 110, sinceService: 2, remainingLaps: 38 });
  });
  it("recalculates Run corrections and deletion without altering service history", () => {
    const records = data(run({ laps: "40" })); expect(componentUsage(records, component).state).toBe("due");
    records.events[0].sessions[0].runs[0].laps = "1"; expect(componentUsage(records, component).sinceService).toBe(21);
    records.events[0].sessions[0].runs = []; expect(componentUsage(records, component).sinceService).toBe(20);
    expect(component.services[0].lapsAtService).toBe(80);
  });
  it("flags service counters above current recorded usage and safe-integer overflow", () => {
    expect(componentUsage(data(), { ...component, services: [{ ...component.services[0], lapsAtService: 120 }] })).toMatchObject({ sinceService: null, state: "check" });
    expect(componentUsage(data(run()), { ...component, initialLaps: Number.MAX_SAFE_INTEGER })).toMatchObject({ totalLaps: null, state: "check" });
  });
});
