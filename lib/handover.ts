import { changesFromPrevious } from "./session-timeline";
import { tyreUsageByRun } from "./tyre-sets";
import { gearRatio } from "./gearing";
import { formatGain, pressureGain, temperatureGain } from "./pressure";
import { formatLapTime, parseLapTime } from "./lap-time";
import { runRecordingPhase } from "./run-recording";
import { recordedRuns, type RecordedRun } from "./experiments";
import type { AppData, ChassisSetup } from "./types";
import type { Translate } from "./i18n";

export type HandoverCard = { title: string; reference: string; context: string[]; sections: Array<{ title: string; rows: Array<{ label: string; value: string }> }> };
const setupFields: Array<[keyof ChassisSetup, string]> = [
  ["frontTrack", "Front track / spacers"], ["rearTrack", "Rear track width"], ["frontRideHeight", "Front ride height"], ["rearRideHeight", "Rear ride height"],
  ["frontToe", "Front toe"], ["frontCamber", "Front camber"], ["caster", "Caster"], ["axleType", "Axle type"], ["rearHub", "Rear hub"],
  ["frontTorsionBar", "Front torsion bar"], ["seatStays", "Seat stays"], ["frontSprocket", "Front sprocket"], ["rearSprocket", "Rear sprocket"], ["wheelType", "Wheel / rim type"], ["notes", "Setup notes"],
];
const text = (value: string) => value.trim() || "—";
const gain = (value: number | null) => value !== null && Number.isFinite(value) ? formatGain(value) : "—";

/** A snapshot of one Run and its named comparison source; no record edits or inferred recommendations. */
export function handoverCard(data: AppData, entry: RecordedRun, t: Translate): HandoverCard {
  const run = entry.run;
  const event = data.events.find(item => item.id === entry.eventId);
  const all = recordedRuns(data.events);
  const set = data.tyreSets.find(item => item.id === run.tyreSetId);
  const age = tyreUsageByRun(data).get(run.id);
  const row = (label: string, value: string) => ({ label, value: text(value) });
  const lap = (value: string) => { const seconds = parseLapTime(value); return seconds === null ? text(value) : formatLapTime(seconds); };
  const baseline = run.experiment?.baselineRunId
    ? all.find(item => item.run.id === run.experiment?.baselineRunId && item.run.id !== run.id)
    : all.filter(item => item.eventId === entry.eventId && item.sessionId === entry.sessionId && item.run.number < run.number).sort((a, b) => b.run.number - a.run.number)[0];
  const changeRows = baseline ? [row(t("Comparison source"), `${baseline.eventName} · ${baseline.sessionName} · Run ${String(baseline.run.number).padStart(2, "0")} · ${t(baseline.conditions.condition)}`),
    ...changesFromPrevious(baseline.run, run).map(change => row(`${change.corner ? `${change.corner.toUpperCase()} · ` : ""}${t(change.label)}`, `${text(change.before)} → ${text(change.after)}${change.unit ? ` ${change.unit}` : ""}`)),
  ] : [row(t("Comparison source"), run.experiment?.baselineRunId ? t("Baseline Run unavailable") : t("No earlier Run in this Session."))];
  if (baseline && baseline.run.tyreSetId !== run.tyreSetId) changeRows.push(row(t("Tyre set"), `${data.tyreSets.find(item => item.id === baseline.run.tyreSetId)?.name || t("No tyre set assigned")} → ${set?.name || t("No tyre set assigned")}`));
  if (baseline && (baseline.conditions.condition !== entry.conditions.condition || baseline.trackLayoutId !== entry.trackLayoutId || baseline.track !== entry.track)) changeRows.push(row(t("Comparison context"), t("Conditions or circuits differ; check the source context.")));
  for (const [key, label] of [["change", t("What I changed")], ["expectation", t("What I expected")], ["outcome", t("What happened")]] as const) {
    if (run.experiment?.[key].trim()) changeRows.push(row(label, run.experiment[key]));
  }
  const ratio = gearRatio(run.setup.frontSprocket, run.setup.rearSprocket);
  return {
    title: t("Mechanic handover card"),
    reference: `Run ${String(run.number).padStart(2, "0")} · ${entry.sessionName}`,
    context: [entry.eventName, `${entry.track || t("Track not set")} · ${entry.date || t("No date")}`, `${entry.sessionName} · Run ${String(run.number).padStart(2, "0")}${run.label ? ` · ${run.label}` : ""}`, run.completed ? t("Completed") : `${t("Unfinished")} · ${runRecordingPhase(run) === "before" ? t("Before Run") : t("After Run")}`],
    sections: [
      { title: t("Conditions"), rows: [row(t("Surface"), t(entry.conditions.condition)), row(t("Ambient temperature"), `${text(entry.conditions.ambientTemperature)} °C`), row(t("Track temperature"), `${text(entry.conditions.trackTemperature)} °C`), ...(event?.weather.trim() ? [row(t("Weather"), event.weather)] : [])] },
      { title: t("Tyre-set context"), rows: [row(t("Tyre set"), set ? `${set.name}${set.compound ? ` · ${set.compound}` : ""}${set.retired ? ` · ${t("Retired")}` : ""}` : t("No tyre set assigned")), ...(age ? [row(t("Recorded age before this Run"), `${age.laps ?? "—"} ${t("Laps")} · ${age.heatCycles ?? "—"} ${t("Recorded heat cycles")}${age.missingLaps ? ` · ${t("Incomplete lap history")}` : ""}`)] : []), row(t("Heat cycle recorded"), run.tyreHeatCycle ? t("Yes") : t("No"))] },
      { title: t("Tyre readings"), rows: (["fl", "fr", "rl", "rr"] as const).map(corner => {
        const tyre = run.tyres[corner];
        return row(corner.toUpperCase(), `${t("Cold")} → ${t("Hot")}: ${text(tyre.coldPressure)} → ${text(tyre.hotPressure)} PSI (${gain(pressureGain(tyre))})\n${text(tyre.coldTemperature)} → ${text(tyre.hotTemperature)} °C (${gain(temperatureGain(tyre))})`);
      }) },
      { title: t("Chassis setup"), rows: [...setupFields.filter(([key]) => run.setup[key].trim()).map(([key, label]) => row(t(label), `${run.setup[key]}${key === "rearTrack" ? " mm" : ""}`)), row(t("Gear ratio"), ratio !== null && Number.isFinite(ratio) ? ratio.toFixed(2) : "—")] },
      { title: t("Performance"), rows: [row(t("Laps"), run.laps), row(t("Fastest lap"), lap(run.fastestLap)), row(t("Average lap"), lap(run.averageLap)), row(t("Max RPM"), run.maxRpm), row(t("Position"), run.position)] },
      { title: t("Recorded changes"), rows: changeRows },
      { title: t("Driver feedback"), rows: [row(t("Balance"), t(run.balance)), row(t("Grip"), t(run.grip)), row(t("Braking"), t(run.braking)), ...[["cornerEntry", t("Corner entry")], ["midCorner", t("Mid-corner")], ["cornerExit", t("Corner exit / traction")], ["comments", t("General comments")]].filter(([key]) => run[key as "cornerEntry"].trim()).map(([key, label]) => row(label, run[key as "cornerEntry"]))] },
    ],
  };
}

/** Wrap by code point when necessary, keeping long words, Chinese text and line breaks intact. */
export function wrapCardText(value: string, measure: (text: string) => number, width: number): string[] {
  return value.split(/\r?\n/).flatMap(paragraph => {
    const lines: string[] = [];
    let line = "";
    for (const token of paragraph.split(/(\s+)/)) {
      if (!token) continue;
      if (measure(line + token) <= width) { line += token; continue; }
      if (line.trim()) { lines.push(line.trimEnd()); line = ""; }
      if (!token.trim()) continue;
      if (measure(token) <= width) { line = token; continue; }
      for (const character of Array.from(token)) {
        if (line && measure(line + character) > width) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line.trimEnd());
    return lines;
  });
}

export type CardLine = { text: string; heading: boolean };
/** Split long cards into bounded pages instead of clipping notes or exceeding mobile canvas limits. */
export function cardPages(card: HandoverCard, measure: (text: string) => number): CardLine[][] {
  const lines = [
    ...card.context.flatMap(value => wrapCardText(value, measure, 900).map(text => ({ text, heading: false }))),
    ...card.sections.flatMap(section => [{ text: section.title, heading: true }, ...section.rows.flatMap(row => wrapCardText(`${row.label}: ${row.value}`, measure, 900).map(text => ({ text, heading: false }))) ]),
  ];
  const pages: CardLine[][] = [];
  // 54 × 36 px of body text plus headers stays below 2200 px on a 1000 px canvas.
  while (lines.length) pages.push(lines.splice(0, 54));
  return pages.length ? pages : [[]];
}
