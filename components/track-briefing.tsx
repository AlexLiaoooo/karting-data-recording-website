"use client";

import { useMemo, useState } from "react";
import { briefingNoteSurfaces, trackBriefing } from "@/lib/track-briefing";
import { sessionConditions, type TrackCondition } from "@/lib/conditions";
import { gearRatio, summariseGearing } from "@/lib/gearing";
import { closestByTemperature, formatGain, pressureGain, summarisePressure } from "@/lib/pressure";
import { runRecordingPhase } from "@/lib/run-recording";
import { markerLabel, type TrackMapData } from "@/lib/track-map/types";
import type { ChassisSetup, EventRecord, SessionRecord, TyreCorner } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";
import { PressureAxles } from "./track-map/pressure-summary";

const conditions: TrackCondition[] = ["Dry", "Damp", "Wet", "Mixed"];
const corners: TyreCorner[] = ["fl", "fr", "rl", "rr"];
const setupFields: Array<[keyof ChassisSetup, string]> = [
  ["frontTrack", "Front track / spacers"], ["rearTrack", "Rear track width"],
  ["frontRideHeight", "Front ride height"], ["rearRideHeight", "Rear ride height"],
  ["frontToe", "Front toe"], ["frontCamber", "Front camber"], ["caster", "Caster"],
  ["axleType", "Axle type"], ["rearHub", "Rear hub"], ["frontTorsionBar", "Front torsion bar"],
  ["seatStays", "Seat stays"], ["frontSprocket", "Front sprocket"], ["rearSprocket", "Rear sprocket"],
  ["wheelType", "Wheel / rim type"], ["notes", "Setup notes"],
];

export function TrackBriefing({ events, event, session, maps }: {
  events: EventRecord[]; event: EventRecord; session?: SessionRecord; maps: TrackMapData;
}) {
  const { t } = useTranslation();
  const current = session ? sessionConditions(event, session) : event;
  const [condition, setCondition] = useState<TrackCondition>(current.condition);
  const briefing = useMemo(() => trackBriefing(events, event, maps), [events, event, maps]);
  const matchingRuns = useMemo(() => briefing.history.filter(entry => entry.conditions.condition === condition), [briefing.history, condition]);
  const gearing = useMemo(() => summariseGearing(matchingRuns.map(entry => ({
    front: entry.run.setup.frontSprocket, rear: entry.run.setup.rearSprocket,
    fastestLap: entry.run.fastestLap, maxRpm: entry.run.maxRpm,
    condition, date: entry.date, eventName: entry.eventName,
  })).filter(run => Number.isFinite(gearRatio(run.front, run.rear)))), [matchingRuns, condition]);
  const pressure = useMemo(() => summarisePressure(matchingRuns.map(entry => ({
    tyres: entry.run.tyres, condition, date: entry.date, eventName: entry.eventName,
    sessionName: entry.sessionName, runNumber: entry.run.number,
    trackTemperature: entry.conditions.trackTemperature, ambientTemperature: entry.conditions.ambientTemperature,
  })))[0], [matchingRuns, condition]);
  const trackTemperature = current.trackTemperature.trim() ? Number(current.trackTemperature) : null;
  const nearest = pressure ? closestByTemperature(pressure.rows, Number.isFinite(trackTemperature) ? trackTemperature : null) : null;
  const surfaces = briefingNoteSurfaces(condition);
  const { layout, track, previous, setup } = briefing;
  const referenceMarkers = layout?.markers.filter(marker => marker.shortInstruction.trim() || marker.generalNote.trim()
    || (surfaces.includes("Dry") && marker.dryNote.trim()) || (surfaces.includes("Wet") && marker.wetNote.trim())) ?? [];
  const pressureEntries = matchingRuns.filter(entry => corners.some(corner => pressureGain(entry.run.tyres[corner]) !== null));
  const runTitle = (number: number) => t("Run {number}", { number: String(number).padStart(2, "0") });
  const stateText = (completed: boolean, phase: "before" | "after") => completed ? t("Completed") : phase === "before" ? t("Before Run") : t("After Run");

  if (briefing.status !== "ready" || !layout || !track) return <div className="page-content">
    <section className="summary-card"><h1>{t("Prepare for this Layout")}</h1><p className="muted">{
      briefing.status === "unlinked" ? t("Edit this Event and choose a saved Track Layout to see its returning-to-track briefing.")
        : briefing.status === "missing-layout" ? t("This Event's saved Layout is unavailable. Edit the Event and choose an existing Layout.")
          : t("Set a valid Event start date to identify earlier visits.")
    }</p></section>
  </div>;

  return <div className="page-content track-briefing">
    <section className="summary-card">
      <p className="eyebrow">{t("RETURNING TO TRACK")}</p><h1>{track.name} · {layout.name}</h1>
      <p className="muted">{event.name}{session ? ` · ${session.name}` : ""} · {event.startDate}</p>
      <p className="muted">{t("Surface")}: {t(current.condition)} · {t("Ambient")}: {current.ambientTemperature.trim() || "—"} °C · {t("Track")}: {current.trackTemperature.trim() || "—"} °C</p>
      <p className="help-text">{t("Earlier Events linked to this exact Layout. The current Event and future visits are excluded.")}</p>
      <div className="briefing-conditions" role="group" aria-label={t("Briefing conditions")}>
        {conditions.map(value => <button type="button" key={value} aria-pressed={condition === value} onClick={() => setCondition(value)}>{t(value)}</button>)}
      </div>
      <p className="help-text">{t("Showing {condition} reference notes and history. Switching this view does not change your Event or Session.", { condition: t(condition) })}</p>
      {briefing.unlinkedCount > 0 && <p className="help-text">{briefing.unlinkedCount === 1
        ? t("1 earlier Event with this track name has no saved Layout link and is excluded.")
        : t("{count} earlier Events with this track name have no saved Layout link and are excluded.", { count: briefing.unlinkedCount })}</p>}
    </section>

    <section className="summary-card" aria-labelledby="briefing-last-visit">
      <h2 id="briefing-last-visit">{t("Previous visit")}</h2>
      {previous ? <>
        <p className="briefing-source"><strong>{previous.name}</strong> · {previous.startDate}</p>
        {setup ? <>
          <h3>{t("Last recorded setup")}</h3>
          <p className="muted">{setup.sessionName} · {runTitle(setup.run.number)}{setup.run.label ? ` · ${setup.run.label}` : ""} · {t(setup.conditions.condition)} · {stateText(setup.run.completed, runRecordingPhase(setup.run))}</p>
          <p className="help-text">{t("Last nonblank setup or cold-pressure record, in Session creation order then Run number. Blank Runs are skipped; unfinished records are labelled.")}</p>
          <dl className="briefing-setup">{setupFields.filter(([key]) => setup.run.setup[key].trim()).map(([key, label]) => <div key={key}><dt>{t(label)}</dt><dd>{setup.run.setup[key]}{key === "rearTrack" ? " mm" : ""}</dd></div>)}</dl>
          <div className="briefing-table-scroll" role="region" aria-label={t("Previous Run tyre pressures")} tabIndex={0}>
            <table><caption>{t("Previous Run tyre pressures")} (PSI)</caption><thead><tr><th scope="col">{t("Tyre")}</th><th scope="col">{t("Cold")}</th><th scope="col">{t("Hot")}</th><th scope="col">{t("Gain")}</th></tr></thead><tbody>{corners.map(corner => {
              const tyre = setup.run.tyres[corner];
              const gain = pressureGain(tyre);
              return <tr key={corner}><th scope="row">{corner.toUpperCase()}</th><td>{tyre.coldPressure.trim() || "—"}</td><td>{tyre.hotPressure.trim() || "—"}</td><td>{gain !== null && Number.isFinite(gain) ? formatGain(gain) : "—"}</td></tr>;
            })}</tbody></table>
          </div>
          {setup.run.comments.trim() && <p className="briefing-note"><strong>{t("Run comments")}</strong><br />{setup.run.comments}</p>}
        </> : <p className="muted">{t("No setup or cold pressures were recorded on the previous visit.")}</p>}
        {previous.notes.trim() && <p className="briefing-note"><strong>{t("Event notes")}</strong><br />{previous.notes}</p>}
        {previous.sessions.filter(item => item.notes.trim()).map(item => <p className="briefing-note" key={item.id}><strong>{item.name} · {t(sessionConditions(previous, item).condition)}</strong><br />{item.notes}</p>)}
        {briefing.visits.filter(({ visit }) => visit.summary.trim() || visit.observations.some(item => item.note.trim())).map(({ visit, session: source }) => <div className="briefing-note" key={visit.id}>
          <strong>{t("Track notes")} · {source.name} · {t(visit.condition)}</strong>
          {visit.summary.trim() && <p>{visit.summary}</p>}
          {visit.observations.filter(item => item.note.trim()).map(item => {
            const marker = layout.markers.find(candidate => candidate.id === item.markerId);
            return <p key={item.id}><strong>{marker ? markerLabel(marker, layout.corners) || t(marker.type) : t("Marker unavailable")}{item.result ? ` · ${t(item.result)}` : ""}</strong><br />{item.note}</p>;
          })}
        </div>)}
      </> : <p className="muted">{t("No earlier visit recorded for this Layout yet. Saved reference notes are still available below.")}</p>}
    </section>

    <section className="summary-card" aria-labelledby="briefing-reference-notes">
      <h2 id="briefing-reference-notes">{t("Reference notes")} · {t(condition)}</h2>
      {track.notes?.trim() && <p className="briefing-note"><strong>{t("Track")}</strong><br />{track.notes}</p>}
      {layout.notes?.trim() && <p className="briefing-note"><strong>{layout.name}</strong><br />{layout.notes}</p>}
      {referenceMarkers.map(marker => <article className="briefing-note" key={marker.id}>
        <h3>{markerLabel(marker, layout.corners) || t(marker.type)}</h3>
        {marker.shortInstruction.trim() && <p>{marker.shortInstruction}</p>}
        {marker.generalNote.trim() && <p>{marker.generalNote}</p>}
        {surfaces.includes("Dry") && marker.dryNote.trim() && <p><strong>{t("Dry")}</strong> · {marker.dryNote}</p>}
        {surfaces.includes("Wet") && marker.wetNote.trim() && <p><strong>{t("Wet")}</strong> · {marker.wetNote}</p>}
      </article>)}
      {!track.notes?.trim() && !layout.notes?.trim() && !referenceMarkers.length && <p className="muted">{t("No reference notes saved for these conditions.")}</p>}
    </section>

    <section className="summary-card" aria-labelledby="briefing-gearing">
      <h2 id="briefing-gearing">{t("Gearing history")} · {t(condition)}</h2>
      {gearing.length ? <div className="briefing-table-scroll" role="region" aria-label={t("Gearing history")} tabIndex={0}>
        <table><caption>{t("Recorded gearing for {condition}", { condition: t(condition) })}</caption><thead><tr><th scope="col">{t("Gearing")}</th><th scope="col">{t("Runs")}</th><th scope="col">{t("Best")}</th><th scope="col">{t("Max RPM")}</th></tr></thead><tbody>{gearing.map(item => <tr key={`${item.front}/${item.rear}`}>
          <th scope="row">{item.front}/{item.rear}<br /><span className="muted">{item.ratio.toFixed(2)} · {item.lastUsed}<br />{item.lastEvent}</span></th><td>{item.runs}</td><td>{item.bestLap || "—"}</td><td>{item.maxRpm || "—"}</td>
        </tr>)}</tbody></table>
      </div> : <p className="muted">{t("No usable gearing recorded on earlier visits in {condition} conditions.", { condition: t(condition) })}</p>}
      <p className="help-text">{t("Recorded history includes unfinished Runs. It does not recommend a setup or target pressure.")}</p>
    </section>

    <section className="summary-card" aria-labelledby="briefing-pressure">
      <h2 id="briefing-pressure">{t("Pressure history")} · {t(condition)}</h2>
      {pressure ? <>
        <p>{pressure.rows.length === 1 ? t("1 Run with paired cold/hot readings") : t("{count} Runs with paired cold/hot readings", { count: pressure.rows.length })}</p>
        <PressureAxles front={pressure.front} rear={pressure.rear} />
        {nearest && <p className="help-text">{t("Closest recorded track temperature: {temperature} °C · {event} · {session} · Run {number}", {
          temperature: String(nearest.trackTemperature), event: nearest.eventName, session: nearest.sessionName, number: String(nearest.runNumber).padStart(2, "0"),
        })}</p>}
        <details className="briefing-pressure-details"><summary>{t("Recorded pressure readings")}</summary>
          <p className="help-text">{t("Scroll sideways to see every tyre.")}</p>
          <div className="briefing-table-scroll" role="region" aria-label={t("Recorded pressure readings")} tabIndex={0}>
            <table><caption>{t("Cold → hot (gain), PSI. Missing readings are shown as —.")}</caption><thead><tr><th scope="col">{t("Run")}</th><th scope="col">{t("Track")} °C</th>{corners.map(corner => <th scope="col" key={corner}>{corner.toUpperCase()}</th>)}</tr></thead><tbody>{pressureEntries.map(entry => <tr key={`${entry.eventId}/${entry.sessionId}/${entry.run.id}`}>
              <th scope="row">{entry.date}<br />{entry.eventName}<br />{entry.sessionName} · {runTitle(entry.run.number)}<br /><span className="muted">{stateText(entry.run.completed, runRecordingPhase(entry.run))}</span></th>
              <td>{entry.conditions.trackTemperature.trim() || "—"}</td>{corners.map(corner => {
                const tyre = entry.run.tyres[corner];
                const gain = pressureGain(tyre);
                return <td key={corner}>{tyre.coldPressure.trim() || "—"} → {tyre.hotPressure.trim() || "—"}<br />({gain !== null && Number.isFinite(gain) ? formatGain(gain) : "—"})</td>;
              })}
            </tr>)}</tbody></table>
          </div>
        </details>
      </> : <p className="muted">{t("No paired cold/hot pressure readings recorded on earlier visits in {condition} conditions.", { condition: t(condition) })}</p>}
    </section>
  </div>;
}
