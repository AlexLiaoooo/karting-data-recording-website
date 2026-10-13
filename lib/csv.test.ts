import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";
import { emptyTrackMapData } from "./track-map/types";
import { makeAppData, makeEvent, makeLayout, makeRun, makeSession, makeTrackMapData, parseCsvRow } from "./test-fixtures";

function tables(csv: string) {
  return csv.replace(/^﻿/, "").split("\r\n\r\n").map((block) => block.split("\r\n").map(parseCsvRow));
}

describe("buildCsv", () => {
  it("appends audio metadata without putting recordings in spreadsheets and leaves missing notes blank", () => {
    const note = { recordedAt: "2026-10-12T09:00:00.000Z", durationMs: 3500, mimeType: "audio/webm" as const, size: 4, dataUrl: "data:audio/webm;base64,AQIDBA==" };
    const data = makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs: [makeRun({ driverDebrief: note }), makeRun({ id: "other", number: 2 })] }), makeSession({ id: "empty", runs: [] })] })] });
    const csv = buildCsv(data, emptyTrackMapData());
    const [runs] = tables(csv); const first = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));
    expect(first["Driver audio recorded at"]).toBe(note.recordedAt); expect(first["Driver audio duration (s)"]).toBe("3.5");
    expect(first["Driver audio type"]).toBe("audio/webm"); expect(first["Driver audio size (bytes)"]).toBe("4");
    expect(csv).not.toContain(note.dataUrl); expect(csv).not.toContain("AQIDBA==");
    for (const row of [runs[2], runs[3]]) for (const header of ["Driver audio recorded at", "Driver audio duration (s)", "Driver audio type", "Driver audio size (bytes)"]) expect(row[runs[0].indexOf(header)]).toBe("");
    for (const row of runs.slice(1)) expect(row.length).toBe(runs[0].length);
  });
  it("exports source-photo metadata, installed parts, lifetime counters and service records without image bytes", () => {
    const component = { id: "engine-a", name: "Engine A", kind: "Engine" as const, notes: "Race engine", initialLaps: 100, serviceIntervalLaps: 120, retired: false, services: [{ id: "s", date: "2026-10-10", lapsAtService: 90, notes: "Top-end service" }], createdAt: "stamp", updatedAt: "stamp" };
    const photo = { capturedAt: "2026-10-13T09:00:00.000Z", sourceName: "logger.png", mimeType: "image/png" as const, size: 4, width: 1200, height: 800, dataUrl: "data:image/png;base64,AQIDBA==" };
    const data = makeAppData({ components: [component], events: [makeEvent({ sessions: [makeSession({ runs: [makeRun({ componentIds: [component.id], loggerPhoto: photo })] }), makeSession({ id: "empty", runs: [] })] })] });
    const csv = buildCsv(data, emptyTrackMapData()); const [runs, , , inventory, services] = tables(csv);
    const values = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));
    expect(values["Logger photo source name"]).toBe("logger.png"); expect(values["Installed component names"]).toBe("Engine A"); expect(values["Logger photo size (bytes)"]).toBe("4");
    expect(csv).not.toContain(photo.dataUrl); expect(csv).not.toContain("AQIDBA==");
    expect(inventory[0]).toEqual(["COMPONENTS"]); expect(inventory[2][7]).toBe("112"); expect(inventory[2][8]).toBe("22");
    expect(services[0]).toEqual(["COMPONENT SERVICES"]); expect(services[2]).toEqual(["engine-a", "Engine A", "Engine", "s", "2026-10-10", "90", "Top-end service"]);
    expect(runs[2].length).toBe(runs[0].length); expect(runs[2].slice(-8)).toEqual(Array(8).fill(""));
  });
  it("exports tyre identity, age before each Run, cycle flags and a tyre-set inventory table", () => {
    const set = { id: "set-1", name: "Dry A", compound: "Medium", notes: "Used before recording", initialLaps: 20, initialHeatCycles: 2, retired: false, createdAt: "stamp", updatedAt: "stamp" };
    const data = makeAppData({ tyreSets: [set], events: [makeEvent({ sessions: [makeSession({ runs: [makeRun({ tyreSetId: "set-1", tyreHeatCycle: true })] })] })] });
    const [runs, , , inventory] = tables(buildCsv(data, emptyTrackMapData()));
    const row = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));
    expect(row["Tyre set ID"]).toBe("set-1");
    expect(row["Recorded tyre laps before Run"]).toBe("20");
    expect(row["Heat cycle recorded"]).toBe("Yes");
    expect(inventory[0]).toEqual(["TYRE SETS"]);
    expect(inventory[2]).toHaveLength(inventory[1].length);
    expect(inventory[2][7]).toBe("32");
  });
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

  /**
   * The export used its own subtraction, which turned a mistyped 0 cold pressure into a gain of
   * 12.50 that no screen in the app would show. It now counts the readings the screens count.
   */
  it("leaves a gain blank where the app shows none, and keeps a real winter temperature", () => {
    const run = makeRun({
      tyres: {
        fl: { coldPressure: "0", hotPressure: "12.5", coldTemperature: "-2", hotTemperature: "33" },
        fr: { coldPressure: "10.0", hotPressure: " ", coldTemperature: "18", hotTemperature: "" },
        rl: { coldPressure: "", hotPressure: "", coldTemperature: "", hotTemperature: "" },
        rr: { coldPressure: "", hotPressure: "", coldTemperature: "", hotTemperature: "" },
      },
    });
    const data = makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs: [run] })] })] });
    const [runs] = tables(buildCsv(data, emptyTrackMapData()));
    const row = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));

    expect(row["FL pressure gain (PSI)"]).toBe("");
    expect(row["FR pressure gain (PSI)"]).toBe("");
    expect(row["FL temperature gain (C)"]).toBe("35.00");
  });

  /**
   * The ratio is derived, so it has a header but no field in setupFields. That asymmetry is what
   * the blank-run padding has to account for, and the column-count test below is what catches it.
   */
  it("exports the gear ratio derived from the sprockets", () => {
    const [runs] = tables(buildCsv(makeAppData(), emptyTrackMapData()));
    const row = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));

    expect(row["Front sprocket"]).toBe("11");
    expect(row["Rear sprocket"]).toBe("82");
    expect(row["Gear ratio"]).toBe("7.45");
  });

  /**
   * The column is headed "(s)", so a lap typed in minutes and seconds has to be converted or the
   * header is a lie. A lap already in seconds passes through untouched, trailing zeros included,
   * so exports made before this change still match.
   */
  it("exports a lap written in minutes and seconds as seconds", () => {
    const withClockLap = makeAppData();
    withClockLap.events[0].sessions[0].runs[0].fastestLap = "1:02.5";
    const [runs] = tables(buildCsv(withClockLap, emptyTrackMapData()));
    const row = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));

    expect(row["Fastest lap (s)"]).toBe("62.5");
  });

  it("leaves a lap already written in seconds exactly as typed", () => {
    const [runs] = tables(buildCsv(makeAppData(), emptyTrackMapData()));
    const row = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));

    expect(row["Fastest lap (s)"]).toBe("48.21");
  });

  it("exports the Event's conditions for a Session that recorded none of its own", () => {
    const [runs] = tables(buildCsv(makeAppData(), emptyTrackMapData()));
    const row = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));

    expect(row["Session track condition"]).toBe(row["Track condition"]);
    expect(row["Session track temperature (C)"]).toBe(row["Track temperature (C)"]);
  });

  /** The point of the columns: a wet Session inside a dry Event is exported as wet. */
  it("exports a Session's own conditions where it recorded them", () => {
    const data = makeAppData();
    data.events[0].condition = "Dry";
    data.events[0].sessions[0].condition = "Wet";
    data.events[0].sessions[0].trackTemperature = "14";
    const [runs] = tables(buildCsv(data, emptyTrackMapData()));
    const row = Object.fromEntries(runs[0].map((header, index) => [header, runs[1][index]]));

    expect(row["Track condition"]).toBe("Dry");
    expect(row["Session track condition"]).toBe("Wet");
    expect(row["Session track temperature (C)"]).toBe("14");
  });

  /**
   * An observation is stamped with its Session's condition when filed. A Session marked wet
   * afterwards keeps the old stamp, so the export reads the Session instead.
   */
  it("exports an observation under its Session's current condition, not the stamp it was filed with", () => {
    const data = makeAppData();
    data.events[0].condition = "Dry";
    data.events[0].sessions[0].condition = "Wet";
    const trackMap = makeTrackMapData();
    trackMap.visits = trackMap.visits.map((visit) => ({ ...visit, condition: "Dry" }));
    const [, , observations] = tables(buildCsv(data, trackMap));
    const row = Object.fromEntries(observations[1].map((header, index) => [header, observations[2][index]]));

    expect(row["Condition"]).toBe("Wet");
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
