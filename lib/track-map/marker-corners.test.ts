import { describe, expect, it } from "vitest";
import { attachMarkersToCorners } from "./database";
import { markerLabel, type TrackCorner } from "./types";
import { makeLayout, makeMarker, makeTrackMapData } from "../test-fixtures";

const corners: TrackCorner[] = [
  { number: 1, label: "T1", x: 0.2, y: 0.4 },
  { number: 2, label: "T2", x: 0.5, y: 0.6 },
  { number: 3, label: "T3", x: 0.8, y: 0.3 },
];

describe("markerLabel", () => {
  it("names a corner marker from the current corner list, not from stored text", () => {
    const marker = makeMarker({ label: "", cornerNumber: 2 });
    expect(markerLabel(marker, corners)).toBe("T2");
  });

  /**
   * The reason the corner number is stored rather than its label. Whilton Mill gained a Turn 1,
   * which pushed every other corner up by one; a marker holding the text "T2" would still read
   * T2 while sitting on what is now T3.
   */
  it("follows a renumbered circuit", () => {
    const marker = makeMarker({ label: "", cornerNumber: 2 });
    const renumbered = corners.map((corner) => ({ ...corner, number: corner.number + 1, label: `T${corner.number + 1}` }));

    expect(markerLabel(marker, renumbered)).toBe("T2");
    expect(markerLabel({ ...marker, cornerNumber: 3 }, renumbered)).toBe("T3");
  });

  it("lets a name the user typed win over the corner", () => {
    const marker = makeMarker({ label: "Brake board", cornerNumber: 2 });
    expect(markerLabel(marker, corners)).toBe("Brake board");
  });

  it("returns free text for a marker placed away from any corner", () => {
    expect(markerLabel(makeMarker({ label: "Bump on entry", cornerNumber: undefined }), corners)).toBe("Bump on entry");
  });

  it("returns nothing rather than a stale name when the corner is gone", () => {
    expect(markerLabel(makeMarker({ label: "", cornerNumber: 9 }), corners)).toBe("");
  });

  it("does not need a corner list to name a free marker", () => {
    expect(markerLabel(makeMarker({ label: "Kerb" }))).toBe("Kerb");
  });
});

describe("attachMarkersToCorners", () => {
  const withMarkers = (markers: ReturnType<typeof makeMarker>[]) =>
    makeTrackMapData({ layouts: [makeLayout({ corners, markers })], visits: [] });

  it("links a marker sitting on a corner and drops the label the app wrote for it", () => {
    const data = withMarkers([makeMarker({ id: "m1", x: 0.5, y: 0.6, label: "T2" })]);
    const marker = attachMarkersToCorners(data).layouts[0].markers[0];

    expect(marker.cornerNumber).toBe(2);
    expect(marker.label).toBe("");
    expect(markerLabel(marker, corners)).toBe("T2");
  });

  /**
   * Position is the only trustworthy signal. A marker written before the Whilton Mill renumber
   * carries the text of the corner it was placed on, which now names a different corner — so
   * matching on the label would move it to the wrong one.
   */
  it("matches on position, not on the stale label", () => {
    const data = withMarkers([makeMarker({ id: "m1", x: 0.8, y: 0.3, label: "T2" })]);
    const marker = attachMarkersToCorners(data).layouts[0].markers[0];

    expect(marker.cornerNumber).toBe(3);
    expect(markerLabel(marker, corners)).toBe("T3");
  });

  it("keeps a name the user typed, and still links the corner underneath it", () => {
    const data = withMarkers([makeMarker({ id: "m1", x: 0.2, y: 0.4, label: "Late apex" })]);
    const marker = attachMarkersToCorners(data).layouts[0].markers[0];

    expect(marker.cornerNumber).toBe(1);
    expect(marker.label).toBe("Late apex");
    expect(markerLabel(marker, corners)).toBe("Late apex");
  });

  it("leaves a marker placed between corners unlinked", () => {
    const data = withMarkers([makeMarker({ id: "m1", x: 0.35, y: 0.5, label: "Bumps" })]);
    const marker = attachMarkersToCorners(data).layouts[0].markers[0];

    expect(marker.cornerNumber).toBeUndefined();
    expect(marker.label).toBe("Bumps");
  });

  it("never re-points a marker that already carries a corner", () => {
    const data = withMarkers([makeMarker({ id: "m1", x: 0.5, y: 0.6, label: "", cornerNumber: 1 })]);
    expect(attachMarkersToCorners(data).layouts[0].markers[0].cornerNumber).toBe(1);
  });

  it("returns the input untouched when nothing needs linking, so no save is triggered", () => {
    const data = withMarkers([makeMarker({ id: "m1", x: 0.35, y: 0.5, label: "Bumps" })]);
    expect(attachMarkersToCorners(data)).toBe(data);
  });

  it("does nothing on a layout that has no corners", () => {
    const data = makeTrackMapData({ layouts: [makeLayout({ corners: undefined, markers: [makeMarker({ x: 0.2, y: 0.4 })] })], visits: [] });
    expect(attachMarkersToCorners(data)).toBe(data);
  });
});
