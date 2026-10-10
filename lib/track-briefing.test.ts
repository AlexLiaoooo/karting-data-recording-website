import { describe, expect, it } from "vitest";
import { briefingNoteSurfaces, trackBriefing } from "./track-briefing";
import { makeEvent, makeLayout, makeRun, makeSession, makeTrackMapData, makeVisit } from "./test-fixtures";
import { createRun } from "./types";

const current = makeEvent({ id: "current", trackLayoutId: "layout-1", startDate: "2026-10-11", createdAt: "2026-10-11T09:00:00Z" });
const past = makeEvent({ id: "past", trackLayoutId: "layout-1" });

describe("returning-to-track briefing", () => {
  it("matches exact Layout IDs, excludes current/future visits, and sorts independently of the Event list", () => {
    const older = { ...past, id: "older", startDate: "2026-07-01" };
    const other = { ...past, id: "other-layout", trackLayoutId: "layout-2", startDate: "2026-10-01" };
    const future = { ...past, id: "future", startDate: "2026-11-01" };
    const result = trackBriefing([current, older, future, other, past], current, makeTrackMapData());
    expect(result.previous?.id).toBe("past");
    expect(result.history.map(entry => entry.eventId)).toEqual(["past", "older"]);
  });

  it("uses creation time for same-day visits and excludes ambiguous equal-time or later Events", () => {
    const morning = { ...past, id: "morning", startDate: current.startDate, createdAt: "2026-10-11T08:00:00Z" };
    const evening = { ...morning, id: "evening", createdAt: "2026-10-11T10:00:00Z" };
    expect(trackBriefing([past, morning, evening, { ...current, id: "tie" }, current], current, makeTrackMapData()).previous?.id).toBe("morning");
  });

  it("does not guess a Layout from a track name", () => {
    const result = trackBriefing([past, current], { ...current, trackLayoutId: undefined }, makeTrackMapData());
    expect(result.status).toBe("unlinked");
    expect(result.history).toEqual([]);
  });

  it.each([
    makeTrackMapData({ layouts: [] }),
    makeTrackMapData({ tracks: [] }),
    makeTrackMapData({ layouts: [makeLayout({ id: "other" })] }),
  ])("handles missing saved Layouts or Tracks", maps => {
    const result = trackBriefing([past, current], current, maps);
    expect(result.status).toBe("missing-layout");
    expect(result.previous).toBeUndefined();
  });

  it("requires usable dates rather than guessing visit order", () => {
    const invalid = { ...past, id: "invalid", startDate: "2026-09-31" };
    expect(trackBriefing([invalid, past, current], current, makeTrackMapData()).previous?.id).toBe("past");
    expect(trackBriefing([past], { ...current, startDate: "" }, makeTrackMapData()).status).toBe("missing-date");
  });

  it("takes the final meaningful setup in Session creation / Run number order without mutating records", () => {
    const beforeRun = { ...makeRun({ id: "prepared", number: 3, completed: false, recordingPhase: "before" }) };
    const event = { ...past, sessions: [makeSession(), makeSession({ id: "later", runs: [createRun(4), beforeRun, makeRun({ number: 2 })] })] };
    const snapshot = JSON.stringify(event);
    const result = trackBriefing([event], current, makeTrackMapData());
    expect(result.setup?.run.id).toBe("prepared");
    expect(result.setup?.run.completed).toBe(false);
    expect(JSON.stringify(event)).toBe(snapshot);
  });

  it("keeps an empty previous visit explicit rather than borrowing an older setup", () => {
    const recent = { ...past, id: "empty", startDate: "2026-10-01", sessions: [] };
    const result = trackBriefing([past, recent], current, makeTrackMapData());
    expect(result.previous?.id).toBe("empty");
    expect(result.setup).toBeUndefined();
    expect(result.history).toHaveLength(1);
  });

  it("preserves inherited and overridden conditions in history", () => {
    const wet = makeSession({ id: "wet", condition: "Wet", trackTemperature: "14" });
    const result = trackBriefing([{ ...past, sessions: [makeSession(), wet] }], current, makeTrackMapData());
    expect(result.history.map(entry => [entry.conditions.condition, entry.conditions.trackTemperature])).toEqual([["Dry", "27"], ["Wet", "14"]]);
  });

  it("includes only the previous visit's existing Sessions and counts unlinked names only as a hint", () => {
    const maps = makeTrackMapData({ visits: [makeVisit({ eventId: "past" }), makeVisit({ id: "orphan", eventId: "past", sessionId: "deleted" }), makeVisit({ id: "current", eventId: "current" })] });
    const result = trackBriefing([past, { ...past, id: "unlinked", trackLayoutId: undefined }], current, maps);
    expect(result.visits.map(entry => entry.visit.id)).toEqual(["visit-1"]);
    expect(result.unlinkedCount).toBe(1);
    expect(result.history).toHaveLength(1);
  });

  it("can show reference notes even when there are no earlier visits", () => {
    const result = trackBriefing([current], current, makeTrackMapData());
    expect(result.status).toBe("ready");
    expect(result.layout?.markers).toHaveLength(1);
    expect(result.previous).toBeUndefined();
  });

  it.each([
    ["Dry", ["Dry"]], ["Wet", ["Wet"]], ["Damp", ["Dry", "Wet"]], ["Mixed", ["Dry", "Wet"]],
  ] as const)("shows relevant reference surfaces for %s", (condition, surfaces) => {
    expect(briefingNoteSurfaces(condition)).toEqual(surfaces);
  });
});
