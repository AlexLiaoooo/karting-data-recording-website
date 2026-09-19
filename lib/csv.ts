import type { AppData, ChassisSetup, RunRecord, TyreCorner } from "./types";
import { markerLabel, type TrackMapData } from "./track-map/types";
import { gearRatio } from "./gearing";

const tyreLabels: Array<[TyreCorner, string]> = [
  ["fl", "FL"],
  ["fr", "FR"],
  ["rl", "RL"],
  ["rr", "RR"],
];

const setupFields: Array<[keyof ChassisSetup, string]> = [
  ["frontTrack", "Front track / spacers"],
  ["rearTrack", "Rear track width"],
  ["frontRideHeight", "Front ride height"],
  ["rearRideHeight", "Rear ride height"],
  ["frontToe", "Front toe"],
  ["frontCamber", "Front camber"],
  ["caster", "Caster"],
  ["axleType", "Axle type"],
  ["rearHub", "Rear hub"],
  ["frontTorsionBar", "Front torsion bar"],
  ["seatStays", "Seat stays"],
  ["frontSprocket", "Front sprocket"],
  ["rearSprocket", "Rear sprocket"],
  ["wheelType", "Wheel / rim type"],
  ["notes", "Setup notes"],
];

const eventHeaders = [
  "Event name",
  "Track",
  "Event start date",
  "Event end date",
  "Event type",
  "Weather",
  "Ambient temperature (C)",
  "Track temperature (C)",
  "Track condition",
  "Event notes",
];

const sessionHeaders = ["Session name", "Session type", "Session start time", "Session notes"];

/**
 * The Run's own columns, in the order runValues emits them.
 *
 * Split out and counted rather than folded into one list with a hard-coded width, because the
 * padding for a Session with no Runs has to match this length exactly and a literal there goes
 * stale the moment a column is added.
 */
const runHeaders = [
  "Run number",
  "Run label",
  "Recorded at",
  "Completed",
  "Laps",
  "Fastest lap (s)",
  "Average lap (s)",
  "Max RPM",
  "Position",
];

const baseHeaders = [...eventHeaders, ...sessionHeaders, ...runHeaders];

const tyreHeaders = tyreLabels.flatMap(([, label]) => [
  `${label} cold pressure (PSI)`,
  `${label} hot pressure (PSI)`,
  `${label} pressure gain (PSI)`,
  `${label} cold temperature (C)`,
  `${label} hot temperature (C)`,
  `${label} temperature gain (C)`,
]);

const feedbackHeaders = [
  "Balance",
  "Grip",
  "Braking",
  "Corner entry",
  "Mid-corner",
  "Corner exit / traction",
  "General comments",
];

function numericDelta(hot: string, cold: string) {
  const hotNumber = Number(hot);
  const coldNumber = Number(cold);
  return hot && cold && Number.isFinite(hotNumber) && Number.isFinite(coldNumber)
    ? (hotNumber - coldNumber).toFixed(2)
    : "";
}

function runValues(run?: RunRecord) {
  if (!run) {
    // The + 1 is the derived gear ratio, which has a header but no field in setupFields.
    return Array(runHeaders.length + tyreHeaders.length + setupFields.length + 1 + feedbackHeaders.length).fill("");
  }

  return [
    run.number,
    run.label,
    run.recordedAt,
    run.completed ? "Yes" : "No",
    run.laps,
    run.fastestLap,
    run.averageLap,
    run.maxRpm,
    run.position,
    ...tyreLabels.flatMap(([corner]) => {
      const tyre = run.tyres[corner];
      return [
        tyre.coldPressure,
        tyre.hotPressure,
        numericDelta(tyre.hotPressure, tyre.coldPressure),
        tyre.coldTemperature,
        tyre.hotTemperature,
        numericDelta(tyre.hotTemperature, tyre.coldTemperature),
      ];
    }),
    ...setupFields.map(([field]) => run.setup[field]),
    // Derived rather than stored, and exported for the same reason pressure gain is: the
    // spreadsheet should not have to recompute what the app already knows how to compute.
    gearRatio(run.setup.frontSprocket, run.setup.rearSprocket)?.toFixed(2) ?? "",
    run.balance,
    run.grip,
    run.braking,
    run.cornerEntry,
    run.midCorner,
    run.cornerExit,
    run.comments,
  ];
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

const markerHeaders = [
  "Track",
  "Track location",
  "Layout",
  "Direction",
  "Marker order",
  "Marker label",
  "Marker type",
  "Short instruction",
  "General note",
  "Dry note",
  "Wet note",
];

const observationHeaders = [
  "Event name",
  "Session name",
  "Track",
  "Layout",
  "Visit date",
  "Condition",
  "Marker label",
  "Marker type",
  "Observation",
  "Result",
  "Session track summary",
];

function markerRows(trackMap: TrackMapData) {
  const rows: unknown[][] = [];

  for (const layout of trackMap.layouts) {
    const track = trackMap.tracks.find((candidate) => candidate.id === layout.trackId);
    const layoutValues = [track?.name ?? "", track?.location ?? "", layout.name, layout.direction];

    if (!layout.markers.length) {
      rows.push([...layoutValues, "", "", "", "", "", "", ""]);
      continue;
    }

    for (const marker of [...layout.markers].sort((a, b) => a.order - b.order)) {
      rows.push([
        ...layoutValues,
        marker.order,
        markerLabel(marker, layout.corners),
        marker.type,
        marker.shortInstruction,
        marker.generalNote,
        marker.dryNote,
        marker.wetNote,
      ]);
    }
  }

  return rows;
}

function observationRows(data: AppData, trackMap: TrackMapData) {
  const rows: unknown[][] = [];

  for (const visit of trackMap.visits) {
    const layout = trackMap.layouts.find((candidate) => candidate.id === visit.layoutId);
    const track = layout ? trackMap.tracks.find((candidate) => candidate.id === layout.trackId) : undefined;
    const event = data.events.find((candidate) => candidate.id === visit.eventId);
    const session = event?.sessions.find((candidate) => candidate.id === visit.sessionId);
    const visitValues = [
      event?.name ?? "",
      session?.name ?? "",
      track?.name ?? "",
      layout?.name ?? "",
      visit.date,
      visit.condition,
    ];

    if (!visit.observations.length) {
      rows.push([...visitValues, "", "", "", "", visit.summary]);
      continue;
    }

    for (const observation of visit.observations) {
      const marker = layout?.markers.find((candidate) => candidate.id === observation.markerId);
      rows.push([
        ...visitValues,
        marker ? markerLabel(marker, layout?.corners) : "",
        marker?.type ?? "",
        observation.note,
        observation.result,
        visit.summary,
      ]);
    }
  }

  return rows;
}

function section(title: string, header: string[], rows: unknown[][]) {
  return [[title], header, ...rows];
}

export function buildCsv(data: AppData, trackMap: TrackMapData) {
  const header = [...baseHeaders, ...tyreHeaders, ...setupFields.map(([, label]) => label), "Gear ratio", ...feedbackHeaders];
  const rows: unknown[][] = [];

  for (const event of data.events) {
    const eventValues = [
      event.name,
      event.track,
      event.startDate,
      event.endDate,
      event.type,
      event.weather,
      event.ambientTemperature,
      event.trackTemperature,
      event.condition,
      event.notes,
    ];

    if (!event.sessions.length) {
      rows.push([...eventValues, "", "", "", "", ...runValues()]);
      continue;
    }

    for (const session of event.sessions) {
      const sessionValues = [session.name, session.type, session.startTime, session.notes];
      if (!session.runs.length) {
        rows.push([...eventValues, ...sessionValues, ...runValues()]);
        continue;
      }

      for (const run of session.runs) {
        rows.push([...eventValues, ...sessionValues, ...runValues(run)]);
      }
    }
  }

  const tables = [
    [header, ...rows],
    section("TRACK REFERENCE MARKERS", markerHeaders, markerRows(trackMap)),
    section("SESSION TRACK OBSERVATIONS", observationHeaders, observationRows(data, trackMap)),
  ];

  const body = tables
    .map((table) => table.map((row) => row.map(escapeCsv).join(",")).join("\r\n"))
    .join("\r\n\r\n");

  return `\uFEFF${body}`;
}
