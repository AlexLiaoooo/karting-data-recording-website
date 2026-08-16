import { emptySetup, emptyTyre, type AppData, type EventRecord, type RunRecord, type SessionRecord } from "./types";
import type { MapAsset, Track, TrackLayout, TrackMarker, TrackMapData, TrackVisit } from "./track-map/types";

const STAMP = "2026-08-16T10:00:00.000Z";

export function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "run-1",
    number: 1,
    label: "",
    recordedAt: STAMP,
    laps: "12",
    tyres: {
      fl: { ...emptyTyre(), coldPressure: "10.0", hotPressure: "12.5", coldTemperature: "18", hotTemperature: "48" },
      fr: emptyTyre(),
      rl: emptyTyre(),
      rr: emptyTyre(),
    },
    setup: { ...emptySetup(), frontSprocket: "11", rearSprocket: "82" },
    fastestLap: "48.21",
    averageLap: "48.90",
    position: "3",
    balance: "Understeer",
    grip: "Medium",
    braking: "Good",
    cornerEntry: "",
    midCorner: "",
    cornerExit: "",
    comments: "",
    completed: true,
    updatedAt: STAMP,
    ...overrides,
  };
}

export function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return { id: "session-1", name: "Practice 1", type: "Practice", startTime: "09:30", notes: "", runs: [makeRun()], createdAt: STAMP, ...overrides };
}

export function makeEvent(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "event-1",
    name: "Club Round 4",
    track: "PF International",
    startDate: "2026-08-16",
    endDate: "",
    type: "Race",
    weather: "Overcast",
    ambientTemperature: "19",
    trackTemperature: "27",
    condition: "Dry",
    notes: "",
    sessions: [makeSession()],
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

export function makeAppData(overrides: Partial<AppData> = {}): AppData {
  return { version: 2, events: [makeEvent()], lastEventId: "event-1", setupTemplates: [], ...overrides };
}

export function makeMarker(overrides: Partial<TrackMarker> = {}): TrackMarker {
  return {
    id: "marker-1",
    x: 0.42,
    y: 0.63,
    order: 1,
    label: "T1",
    type: "Brake",
    shortInstruction: "Brake at the 50 board",
    generalNote: "Late apex works",
    dryNote: "",
    wetNote: "Move off the rubber",
    tags: [],
    updatedAt: STAMP,
    ...overrides,
  };
}

export function makeTrack(overrides: Partial<Track> = {}): Track {
  return { id: "track-1", name: "PF International", location: "Grantham, UK", notes: "", createdAt: STAMP, updatedAt: STAMP, ...overrides };
}

export function makeLayout(overrides: Partial<TrackLayout> = {}): TrackLayout {
  return {
    id: "layout-1",
    trackId: "track-1",
    name: "Full Layout",
    direction: "Clockwise",
    mapAssetId: "asset-1",
    markers: [makeMarker()],
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

export function makeVisit(overrides: Partial<TrackVisit> = {}): TrackVisit {
  return {
    id: "visit-1",
    layoutId: "layout-1",
    eventId: "event-1",
    sessionId: "session-1",
    date: "2026-08-16",
    condition: "Dry",
    observations: [
      { id: "obs-1", markerId: "marker-1", sessionId: "session-1", note: "Braked 5m earlier", result: "Better", createdAt: STAMP, updatedAt: STAMP },
    ],
    summary: "Grip improved through the session",
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

export function makeMapAsset(bytes = [1, 2, 3, 4, 250, 251, 252, 253]): MapAsset {
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/webp" });
  return { id: "asset-1", blob, width: 760, height: 1000, mimeType: "image/webp", size: blob.size, updatedAt: STAMP };
}

export function makeTrackMapData(overrides: Partial<TrackMapData> = {}): TrackMapData {
  return { version: 1, tracks: [makeTrack()], layouts: [makeLayout()], visits: [makeVisit()], assets: [makeMapAsset()], ...overrides };
}

export async function blobBytes(value: Blob): Promise<number[]> {
  return [...new Uint8Array(await value.arrayBuffer())];
}

/** Every field written by buildCsv is quoted, so rows parse without ambiguity. */
export function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let index = 0;
  while (index < line.length) {
    if (line[index] !== '"') throw new Error(`Unquoted field at ${index} in: ${line}`);
    index += 1;
    let value = "";
    while (index < line.length) {
      if (line[index] === '"') {
        if (line[index + 1] === '"') { value += '"'; index += 2; continue; }
        index += 1;
        break;
      }
      value += line[index];
      index += 1;
    }
    fields.push(value);
    if (line[index] === ",") index += 1;
  }
  return fields;
}
