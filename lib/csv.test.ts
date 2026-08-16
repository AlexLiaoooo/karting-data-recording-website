import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";
import { emptyTrackMapData } from "./track-map/types";
import { makeAppData, makeEvent, makeLayout, makeRun, makeSession, makeTrackMapData, parseCsvRow } from "./test-fixtures";

function tables(csv: string) {
  return csv.replace(/^﻿/, "").split("\r\n\r\n").map((block) => block.split("\r\n").map(parseCsvRow));
}

describe("buildCsv", () => {
  it("emits three tables: runs, track markers, session observations", () => {
    const [runs, markers, observations] = tables(buildCsv(makeAppData(), makeTrackMapData()));

    expect(runs[0][0]).toBe("Event name");
    expect(markers[0]).toEqual(["TRACK REFERENCE MARKERS"]);
    expect(observations[0]).toEqual(["SESSION TRACK OBSERVATIONS"]);
  });

  it("keeps the run table's original shape, with its header on the first row", () => {
    const csv = buildCsv(makeAppData(), makeTrackMapData());
    expect(csv.startsWith('﻿"Event name"')).toBe(true);
  });

  it("writes a UTF-8 BOM so Excel reads accented and CJK text correctly", () => {
    expect(buildCsv(makeAppData(), emptyTrackMapData()).charCodeAt(0)).toBe(0xfeff);
  });

  it("computes pressure and temperature gains for each corner", () => {
    const [runs] = tables(buildCsv(makeAppData(), emptyTrackMapData()));
    const row = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));

    expect(row["FL pressure gain (PSI)"]).toBe("2.50");
    expect(row["FL temperature gain (C)"]).toBe("30.00");
    expect(row["FR pressure gain (PSI)"]).toBe("");
  });

  it("keeps every row in a table at the header's column count", () => {
    const [runs, markers, observations] = tables(buildCsv(makeAppData(), makeTrackMapData()));

    for (const [name, table, headerIndex] of [["runs", runs, 0], ["markers", markers, 1], ["observations", observations, 1]] as const) {
      const width = table[headerIndex].length;
      for (const row of table.slice(headerIndex + 1)) {
        expect(row.length, `${name} row: ${row.join("|")}`).toBe(width);
      }
    }
  });

  it("escapes quotes and commas in free text", () => {
    const run = makeRun({ comments: 'Said "too loose", then better' });
    const data = makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs: [run] })] })] });
    const [runs] = tables(buildCsv(data, emptyTrackMapData()));
    const row = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));

    expect(row["General comments"]).toBe('Said "too loose", then better');
  });

  it("quotes a note containing a line break rather than splitting the row", () => {
    const run = makeRun({ comments: "Entry snap\nExit fine" });
    const data = makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs: [run] })] })] });

    expect(buildCsv(data, emptyTrackMapData())).toContain('"Entry snap\nExit fine"');
  });

  it("resolves observations back to their Event and Session names", () => {
    const [, , observations] = tables(buildCsv(makeAppData(), makeTrackMapData()));
    const row = Object.fromEntries(observations[1].map((header, index) => [header, observations[2][index]]));

    expect(row["Event name"]).toBe("Club Round 4");
    expect(row["Session name"]).toBe("Practice 1");
    expect(row["Marker label"]).toBe("T1");
    expect(row["Observation"]).toBe("Braked 5m earlier");
    expect(row["Result"]).toBe("Better");
    expect(row["Session track summary"]).toBe("Grip improved through the session");
  });

  it("still lists a layout that has no markers", () => {
    const trackMap = makeTrackMapData({ layouts: [makeLayout({ markers: [] })], visits: [] });
    const [, markers] = tables(buildCsv(makeAppData(), trackMap));
    const row = Object.fromEntries(markers[1].map((header, index) => [header, markers[2][index]]));

    expect(row["Layout"]).toBe("Full Layout");
    expect(row["Marker label"]).toBe("");
  });

  it("emits the marker and observation headers even when there is no track data", () => {
    const [, markers, observations] = tables(buildCsv(makeAppData(), emptyTrackMapData()));

    expect(markers).toHaveLength(2);
    expect(observations).toHaveLength(2);
  });
});
