"use client";

import { BookOpen, Check, Crosshair, Pencil, Upload, X } from "lucide-react";
import { ChangeEvent, MouseEvent, useRef, useState } from "react";
import { optimiseMapImage } from "@/lib/track-map/image-processing";
import {
  markerTypes,
  MarkerObservation,
  Track,
  TrackLayout,
  TrackMapData,
  TrackMarker,
  TrackMarkerType,
  TrackVisit,
} from "@/lib/track-map/types";
import { MapCanvas } from "./MapCanvas";
import { MarkerSheet } from "./MarkerSheet";
import { EmptyMapState, now, SessionContext, TrackMapChange } from "./shared";

type MapWorkspaceProps = {
  data: TrackMapData;
  layout: TrackLayout;
  track: Track;
  session?: SessionContext;
  onChange: TrackMapChange;
  notify: (message: string) => void;
};

export function MapWorkspace({ data, layout, track, session, onChange, notify }: MapWorkspaceProps) {
  const [zoom, setZoom] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [addType, setAddType] = useState<TrackMarkerType | null>(null);
  const [moveMarkerId, setMoveMarkerId] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const asset = data.assets.find((candidate) => candidate.id === layout.mapAssetId);
  const selectedMarker = layout.markers.find((marker) => marker.id === selectedMarkerId);
  const visit = session ? data.visits.find((candidate) => candidate.layoutId === layout.id && candidate.sessionId === session.sessionId) : undefined;
  const observation = selectedMarker && visit ? visit.observations.find((candidate) => candidate.markerId === selectedMarker.id) : undefined;

  function updateLayout(updater: (current: TrackLayout) => TrackLayout) {
    onChange((current) => ({ ...current, layouts: current.layouts.map((candidate) => candidate.id === layout.id ? updater(candidate) : candidate) }));
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const nextAsset = await optimiseMapImage(file);
      onChange((current) => ({
        ...current,
        assets: [...current.assets.filter((candidate) => candidate.id !== layout.mapAssetId), nextAsset],
        // Clearing the attribution and version marks the map as user-owned, so the built-in
        // map refresh on startup leaves it alone.
        layouts: current.layouts.map((candidate) => candidate.id === layout.id ? { ...candidate, mapAssetId: nextAsset.id, sourceAttribution: undefined, sourceUrl: undefined, builtInMapVersion: undefined, updatedAt: now() } : candidate),
      }));
      notify(`Map ready · ${nextAsset.width} × ${nextAsset.height}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Map upload failed");
    } finally {
      setUploading(false);
    }
  }

  function mapClicked(event: MouseEvent<HTMLDivElement>) {
    if (session || (!addType && !moveMarkerId)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    if (moveMarkerId) {
      updateLayout((current) => ({ ...current, updatedAt: now(), markers: current.markers.map((marker) => marker.id === moveMarkerId ? { ...marker, x, y, updatedAt: now() } : marker) }));
      setMoveMarkerId(null);
      notify("Marker moved");
      return;
    }
    if (!addType) return;
    const marker: TrackMarker = {
      id: crypto.randomUUID(), x, y, order: layout.markers.length + 1,
      label: addType === "Corner" ? `T${layout.markers.filter((candidate) => candidate.type === "Corner").length + 1}` : addType,
      type: addType, shortInstruction: "", generalNote: "", dryNote: "", wetNote: "", tags: [], updatedAt: now(),
    };
    updateLayout((current) => ({ ...current, markers: [...current.markers, marker], updatedAt: now() }));
    setSelectedMarkerId(marker.id);
    setAddType(null);
    notify(`${marker.type} marker added`);
  }

  function updateMarker(patch: Partial<TrackMarker>) {
    if (!selectedMarker) return;
    updateLayout((current) => ({
      ...current,
      updatedAt: now(),
      markers: current.markers.map((marker) => marker.id === selectedMarker.id ? { ...marker, ...patch, updatedAt: now() } : marker),
    }));
  }

  function deleteMarker() {
    if (!selectedMarker || !window.confirm(`Delete marker ${selectedMarker.label || selectedMarker.type}?`)) return;
    onChange((current) => ({
      ...current,
      layouts: current.layouts.map((candidate) => candidate.id === layout.id ? { ...candidate, markers: candidate.markers.filter((marker) => marker.id !== selectedMarker.id), updatedAt: now() } : candidate),
      visits: current.visits.map((candidate) => candidate.layoutId === layout.id ? { ...candidate, observations: candidate.observations.filter((item) => item.markerId !== selectedMarker.id), updatedAt: now() } : candidate),
    }));
    setSelectedMarkerId(null);
    notify("Marker deleted");
  }

  function updateObservation(patch: Partial<Pick<MarkerObservation, "note" | "result">>) {
    if (!session || !selectedMarker) return;
    const timestamp = now();
    onChange((current) => {
      const existingVisit = current.visits.find((candidate) => candidate.layoutId === layout.id && candidate.sessionId === session.sessionId);
      if (!existingVisit) {
        const observation: MarkerObservation = { id: crypto.randomUUID(), markerId: selectedMarker.id, sessionId: session.sessionId, note: "", result: "", createdAt: timestamp, updatedAt: timestamp, ...patch };
        const nextVisit: TrackVisit = { id: crypto.randomUUID(), layoutId: layout.id, eventId: session.eventId, sessionId: session.sessionId, date: timestamp.slice(0, 10), condition: session.condition, observations: [observation], summary: "", createdAt: timestamp, updatedAt: timestamp };
        return { ...current, visits: [...current.visits, nextVisit] };
      }
      return {
        ...current,
        visits: current.visits.map((candidate) => {
          if (candidate.id !== existingVisit.id) return candidate;
          const existingObservation = candidate.observations.find((item) => item.markerId === selectedMarker.id);
          const newObservation: MarkerObservation = { id: crypto.randomUUID(), markerId: selectedMarker.id, sessionId: session.sessionId, note: "", result: "", createdAt: timestamp, updatedAt: timestamp, ...patch };
          const observations = existingObservation
            ? candidate.observations.map((item) => item.id === existingObservation.id ? { ...item, ...patch, updatedAt: timestamp } : item)
            : [...candidate.observations, newObservation];
          return { ...candidate, condition: session.condition, observations, updatedAt: timestamp };
        }),
      };
    });
  }

  function updateSummary(summary: string) {
    if (!session) return;
    const timestamp = now();
    onChange((current) => {
      const existing = current.visits.find((candidate) => candidate.layoutId === layout.id && candidate.sessionId === session.sessionId);
      if (existing) return { ...current, visits: current.visits.map((candidate) => candidate.id === existing.id ? { ...candidate, summary, updatedAt: timestamp } : candidate) };
      return { ...current, visits: [...current.visits, { id: crypto.randomUUID(), layoutId: layout.id, eventId: session.eventId, sessionId: session.sessionId, date: timestamp.slice(0, 10), condition: session.condition, observations: [], summary, createdAt: timestamp, updatedAt: timestamp }] };
    });
  }

  const conditionNote = selectedMarker
    ? session?.condition === "Dry" ? selectedMarker.dryNote : session?.condition === "Wet" || session?.condition === "Damp" ? selectedMarker.wetNote : ""
    : "";

  return (
    <div className="track-workspace page-content">
      <div className="track-workspace-heading">
        <div><p className="eyebrow">{session ? "SESSION TRACK NOTES" : editMode ? "EDIT MAP" : "REFERENCE MAP"}</p><h1>{track.name}</h1></div>
        {!session && <button className={`button button-small ${editMode ? "button-primary" : "button-secondary"}`} onClick={() => { setEditMode((value) => !value); setAddType(null); setMoveMarkerId(null); }}><Pencil /> {editMode ? "Editing" : "Edit map"}</button>}
      </div>

      {asset ? (
        <>
          {editMode && (
            <div className="marker-add-bar">
              <span>{moveMarkerId ? "Tap the new marker position" : addType ? `Tap map to place ${addType}` : "Add marker:"}</span>
              {!moveMarkerId && <select className="select" value={addType ?? ""} onChange={(event) => setAddType((event.target.value || null) as TrackMarkerType | null)}><option value="">Choose type</option>{markerTypes.map((type) => <option key={type}>{type}</option>)}</select>}
              {(addType || moveMarkerId) && <button className="icon-button" aria-label="Cancel marker placement" onClick={() => { setAddType(null); setMoveMarkerId(null); }}><X /></button>}
            </div>
          )}
          <MapCanvas
            asset={asset}
            alt={`${track.name} ${layout.name} map`}
            markers={layout.markers}
            selectedMarkerId={selectedMarkerId}
            zoom={zoom}
            onZoomChange={setZoom}
            placing={Boolean(addType || moveMarkerId)}
            onMapClick={mapClicked}
            onSelectMarker={setSelectedMarkerId}
          />
          {!session && <div className="map-image-actions"><button className="text-button" onClick={() => fileRef.current?.click()}><Upload /> Replace map image</button><span>{Math.round(asset.size / 1024)} KB</span></div>}
          {layout.sourceAttribution && <p className="map-attribution">{layout.sourceAttribution}{layout.sourceUrl && <> · <a href={layout.sourceUrl} target="_blank" rel="noreferrer">View licence</a></>}</p>}
        </>
      ) : (
        <EmptyMapState title="Add the circuit map" text="Choose a clear overhead layout image. It will be resized and stored only on this device." action={!session && <button className="button button-primary" disabled={uploading} onClick={() => fileRef.current?.click()}><Upload /> {uploading ? "Preparing image…" : "Choose map image"}</button>} />
      )}
      <input className="visually-hidden" ref={fileRef} type="file" accept="image/*" onChange={uploadImage} />

      {selectedMarker ? (
        <MarkerSheet
          marker={selectedMarker}
          mode={session ? "session" : editMode ? "edit" : "reference"}
          session={session}
          observation={observation}
          conditionNote={conditionNote}
          onClose={() => setSelectedMarkerId(null)}
          onUpdateMarker={updateMarker}
          onDeleteMarker={deleteMarker}
          onMove={() => { setMoveMarkerId(selectedMarker.id); setAddType(null); }}
          onUpdateObservation={updateObservation}
        />
      ) : layout.markers.length > 0 ? (
        <p className="map-help"><Crosshair /> Tap a marker to read or edit its notes. Zoom in, then drag the map area to pan.</p>
      ) : asset ? (
        <p className="map-help"><BookOpen /> Switch to Edit map, choose a marker type, then tap its position on the circuit.</p>
      ) : null}

      {session && (
        <section className="settings-section session-map-summary">
          <label className="field"><span>Overall Session track summary</span><textarea className="textarea" placeholder="Overall grip, changing conditions, key lesson…" value={visit?.summary ?? ""} onChange={(event) => updateSummary(event.target.value)} /></label>
          <p className="auto-save-note"><Check /> Saved separately from permanent Track notes</p>
        </section>
      )}
    </div>
  );
}
