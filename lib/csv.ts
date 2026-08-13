import type { AppData, ChassisSetup, RunRecord, TyreCorner } from "./types";

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

const baseHeaders = [
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
  "Session name",
  "Session type",
  "Session start time",
  "Session notes",
  "Run number",
  "Run label",
  "Recorded at",
  "Completed",
  "Laps",
  "Fastest lap (s)",
  "Average lap (s)",
  "Position",
];

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
    return Array(8 + tyreHeaders.length + setupFields.length + feedbackHeaders.length).fill("");
  }

  return [
    run.number,
    run.label,
    run.recordedAt,
    run.completed ? "Yes" : "No",
    run.laps,
    run.fastestLap,
    run.averageLap,
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

export function buildCsv(data: AppData) {
  const header = [...baseHeaders, ...tyreHeaders, ...setupFields.map(([, label]) => label), ...feedbackHeaders];
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

  return `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
}
