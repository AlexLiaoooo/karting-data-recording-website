"use client";

import { Check, Move, Trash2, X } from "lucide-react";
import { markerTypes, MarkerObservation, TrackMarker, TrackMarkerType } from "@/lib/track-map/types";
import { markerClass, markerShortNames, SessionContext } from "./shared";

type MarkerSheetProps = {
  marker: TrackMarker;
  mode: "session" | "edit" | "reference";
  session?: SessionContext;
  observation?: MarkerObservation;
  conditionNote: string;
  onClose: () => void;
  onUpdateMarker: (patch: Partial<TrackMarker>) => void;
  onDeleteMarker: () => void;
  onMove: () => void;
  onUpdateObservation: (patch: Partial<Pick<MarkerObservation, "note" | "result">>) => void;
};

export function MarkerSheet({
  marker,
  mode,
  session,
  observation,
  conditionNote,
  onClose,
  onUpdateMarker,
  onDeleteMarker,
  onMove,
  onUpdateObservation,
}: MarkerSheetProps) {
  const hasReferenceNotes = Boolean(marker.shortInstruction || marker.generalNote || marker.dryNote || marker.wetNote);

  return (
    <section className="marker-panel">
      <div className="marker-panel-head">
        <div>
          <span className={`marker-key ${markerClass(marker.type)}`}>{markerShortNames[marker.type]}</span>
          <div><p className="eyebrow">{marker.type}</p><h2>{marker.label || "Untitled marker"}</h2></div>
        </div>
        <button className="icon-button" aria-label="Close marker" onClick={onClose}><X /></button>
      </div>

      {mode === "session" && session ? (
        <div className="marker-session-content">
          {marker.shortInstruction && <p className="marker-instruction">{marker.shortInstruction}</p>}
          {marker.generalNote && <div className="reference-note"><strong>General reference</strong><p>{marker.generalNote}</p></div>}
          {conditionNote && <div className="reference-note"><strong>{session.condition} reference</strong><p>{conditionNote}</p></div>}
          <label className="field"><span>What happened in {session.sessionName}?</span><textarea className="textarea" placeholder="Grip, line, braking point, what to try next…" value={observation?.note ?? ""} onChange={(event) => onUpdateObservation({ note: event.target.value })} /></label>
          <label className="field"><span>Result</span><select className="select" value={observation?.result ?? ""} onChange={(event) => onUpdateObservation({ result: event.target.value as MarkerObservation["result"] })}><option value="">Not rated</option><option>Better</option><option>Same</option><option>Worse</option></select></label>
          <p className="auto-save-note"><Check /> Session observation saves automatically</p>
        </div>
      ) : mode === "edit" ? (
        <div className="form-grid marker-form">
          <label className="field"><span>Label</span><input className="input" value={marker.label} onChange={(event) => onUpdateMarker({ label: event.target.value })} /></label>
          <label className="field"><span>Type</span><select className="select" value={marker.type} onChange={(event) => onUpdateMarker({ type: event.target.value as TrackMarkerType })}>{markerTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="field field-full"><span>Short instruction</span><input className="input" placeholder="e.g. Brake at marshal post" value={marker.shortInstruction} onChange={(event) => onUpdateMarker({ shortInstruction: event.target.value })} /></label>
          <label className="field field-full"><span>General note</span><textarea className="textarea" value={marker.generalNote} onChange={(event) => onUpdateMarker({ generalNote: event.target.value })} /></label>
          <label className="field field-full"><span>Dry note</span><textarea className="textarea" value={marker.dryNote} onChange={(event) => onUpdateMarker({ dryNote: event.target.value })} /></label>
          <label className="field field-full"><span>Wet note</span><textarea className="textarea" value={marker.wetNote} onChange={(event) => onUpdateMarker({ wetNote: event.target.value })} /></label>
          <div className="marker-actions field-full"><button className="button button-secondary" onClick={onMove}><Move /> Move</button><button className="button button-secondary danger-text" onClick={onDeleteMarker}><Trash2 /> Delete</button></div>
          <p className="auto-save-note field-full"><Check /> Reference marker saves automatically</p>
        </div>
      ) : (
        <div className="marker-reference-content">
          {marker.shortInstruction && <p className="marker-instruction">{marker.shortInstruction}</p>}
          {marker.generalNote && <div className="reference-note"><strong>General</strong><p>{marker.generalNote}</p></div>}
          {marker.dryNote && <div className="reference-note"><strong>Dry</strong><p>{marker.dryNote}</p></div>}
          {marker.wetNote && <div className="reference-note"><strong>Wet</strong><p>{marker.wetNote}</p></div>}
          {!hasReferenceNotes && <p className="help-text">No notes on this marker yet. Switch to Edit map to add them.</p>}
          {/* Delete is reachable here as well as in Edit map: a marker you want gone should
              not require finding edit mode first. Moving still requires Edit map, so nothing
              shifts by accident at the circuit. */}
          <div className="marker-actions">
            <button className="button button-secondary danger-text" onClick={onDeleteMarker}><Trash2 /> Delete marker</button>
          </div>
        </div>
      )}
    </section>
  );
}
