"use client";

import Image from "next/image";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Crosshair,
  ImageIcon,
  MapPinned,
  Minus,
  Moon,
  Move,
  Pencil,
  Plus,
  Sun,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import { ChangeEvent, FormEvent, MouseEvent, ReactNode, useEffect, useRef, useState } from "react";
import { optimiseMapImage } from "@/lib/track-map/image-processing";
import {
  markerTypes,
  MapAsset,
  MarkerObservation,
  Track,
  TrackLayout,
  TrackMapData,
  TrackMarker,
  TrackMarkerType,
  TrackVisit,
} from "@/lib/track-map/types";

type SessionContext = {
  eventId: string;
  sessionId: string;
  eventName: string;
  sessionName: string;
  layoutId?: string;
  condition: "Dry" | "Damp" | "Wet" | "Mixed";
};

type TrackMapFeatureProps = {
  data: TrackMapData;
  mode: "library" | "session";
  session?: SessionContext;
  onChange: (updater: (current: TrackMapData) => TrackMapData) => void;
  onBack: () => void;
  notify: (message: string) => void;
};

type LibraryView =
  | { name: "library" }
  | { name: "track"; trackId: string }
  | { name: "workspace"; layoutId: string };

type EditorState =
  | { kind: "track"; track?: Track }
  | { kind: "layout"; trackId: string; layout?: TrackLayout }
  | null;

const markerShortNames: Record<TrackMarkerType, string> = {
  Corner: "C",
  Braking: "B",
  "Turn-in": "T",
  Apex: "A",
  Exit: "E",
  Hazard: "!",
  Overtaking: "O",
  Focus: "F",
};

function now() {
  return new Date().toISOString();
}

function ThemeButton() {
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("kart-data-theme", next);
  }
  return (
    <button className="icon-button theme-toggle" type="button" aria-label="Switch light or dark mode" onClick={toggleTheme}>
      <span className="theme-icon theme-icon-dark"><Moon /></span>
      <span className="theme-icon theme-icon-light"><Sun /></span>
    </button>
  );
}

function FeatureHeader({ title, subtitle, onBack, actions }: { title: string; subtitle?: string; onBack: () => void; actions?: ReactNode }) {
  return (
    <header className="topbar">
      <button className="icon-button" type="button" aria-label="Back" onClick={onBack}><ArrowLeft /></button>
      <div className="topbar-copy"><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
      <div className="topbar-action">{actions}<ThemeButton /></div>
    </header>
  );
}

function EmptyMapState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <section className="empty-state">
      <span className="empty-icon"><MapPinned /></span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </section>
  );
}

const assetUrlCache = new WeakMap<Blob, string>();

function getAssetUrl(asset?: MapAsset) {
  if (!asset) return "";
  const cached = assetUrlCache.get(asset.blob);
  if (cached) return cached;
  const url = URL.createObjectURL(asset.blob);
  assetUrlCache.set(asset.blob, url);
  return url;
}

function useModalViewport(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const update = () => {
      root.style.setProperty("--visual-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      root.style.setProperty("--visual-viewport-offset-top", `${viewport?.offsetTop ?? 0}px`);
    };
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      root.style.removeProperty("--visual-viewport-height");
      root.style.removeProperty("--visual-viewport-offset-top");
    };
  }, [active]);
}

export function TrackMapFeature({ data, mode, session, onChange, onBack, notify }: TrackMapFeatureProps) {
  const [view, setView] = useState<LibraryView>(() => mode === "session" && session?.layoutId
    ? { name: "workspace", layoutId: session.layoutId }
    : { name: "library" });
  const [editor, setEditor] = useState<EditorState>(null);
  const [search, setSearch] = useState("");
  useModalViewport(Boolean(editor));

  const openTestTrack = async () => {
    const timestamp = now();
    const trackId = crypto.randomUUID();
    const layoutId = crypto.randomUUID();
    let defaultAsset: MapAsset | undefined;
    try {
      const response = await fetch("/maps/pfi-international-owner-driver.svg");
      if (!response.ok) throw new Error("Default map unavailable");
      const blob = await response.blob();
      defaultAsset = { id: crypto.randomUUID(), blob, width: 1200, height: 900, mimeType: "image/svg+xml", size: blob.size, updatedAt: timestamp };
    } catch {
      // The track can still be created if a static asset is unavailable; the user can upload a map later.
    }
    onChange((current) => ({
      ...current,
      tracks: [...current.tracks, { id: trackId, name: "PF International", location: "Grantham, UK", notes: "", createdAt: timestamp, updatedAt: timestamp }],
      layouts: [...current.layouts, { id: layoutId, trackId, name: "Full Layout", direction: "Unknown", mapAssetId: defaultAsset?.id ?? null, sourceAttribution: defaultAsset ? "Geometry derived from OpenStreetMap contributors · ODbL 1.0" : undefined, sourceUrl: defaultAsset ? "https://www.openstreetmap.org/copyright" : undefined, markers: [], createdAt: timestamp, updatedAt: timestamp }],
      assets: defaultAsset ? [...current.assets, defaultAsset] : current.assets,
    }));
    setView({ name: "workspace", layoutId });
    notify(defaultAsset ? "PF International created with a built-in map" : "PF International created — upload your map image next");
  };

  function saveTrack(input: { name: string; location: string; notes: string }) {
    const timestamp = now();
    if (editor?.kind === "track" && editor.track) {
      onChange((current) => ({
        ...current,
        tracks: current.tracks.map((track) => track.id === editor.track?.id ? { ...track, ...input, updatedAt: timestamp } : track),
      }));
      notify("Track updated");
    } else {
      const trackId = crypto.randomUUID();
      const layoutId = crypto.randomUUID();
      onChange((current) => ({
        ...current,
        tracks: [...current.tracks, { ...input, id: trackId, createdAt: timestamp, updatedAt: timestamp }],
        layouts: [...current.layouts, { id: layoutId, trackId, name: "Full Layout", direction: "Unknown", mapAssetId: null, markers: [], createdAt: timestamp, updatedAt: timestamp }],
      }));
      setView({ name: "track", trackId });
      notify("Track created");
    }
    setEditor(null);
  }

  function saveLayout(input: { name: string; direction: TrackLayout["direction"] }) {
    if (!editor || editor.kind !== "layout") return;
    const timestamp = now();
    if (editor.layout) {
      onChange((current) => ({
        ...current,
        layouts: current.layouts.map((layout) => layout.id === editor.layout?.id ? { ...layout, ...input, updatedAt: timestamp } : layout),
      }));
      notify("Layout updated");
    } else {
      const layout: TrackLayout = {
        ...input,
        id: crypto.randomUUID(),
        trackId: editor.trackId,
        mapAssetId: null,
        markers: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      onChange((current) => ({ ...current, layouts: [...current.layouts, layout] }));
      setView({ name: "workspace", layoutId: layout.id });
      notify("Layout created");
    }
    setEditor(null);
  }

  function deleteTrack(track: Track) {
    if (!window.confirm(`Delete ${track.name}, all its layouts, map images and track notes? This cannot be undone.`)) return;
    onChange((current) => {
      const layoutIds = current.layouts.filter((layout) => layout.trackId === track.id).map((layout) => layout.id);
      const assetIds = current.layouts.filter((layout) => layout.trackId === track.id).map((layout) => layout.mapAssetId).filter(Boolean);
      return {
        ...current,
        tracks: current.tracks.filter((candidate) => candidate.id !== track.id),
        layouts: current.layouts.filter((layout) => layout.trackId !== track.id),
        visits: current.visits.filter((visit) => !layoutIds.includes(visit.layoutId)),
        assets: current.assets.filter((asset) => !assetIds.includes(asset.id)),
      };
    });
    setView({ name: "library" });
    notify(`${track.name} deleted`);
  }

  function deleteLayout(layout: TrackLayout) {
    if (!window.confirm(`Delete ${layout.name}, its map image, markers and Session observations? This cannot be undone.`)) return;
    onChange((current) => ({
      ...current,
      layouts: current.layouts.filter((candidate) => candidate.id !== layout.id),
      visits: current.visits.filter((visit) => visit.layoutId !== layout.id),
      assets: layout.mapAssetId ? current.assets.filter((asset) => asset.id !== layout.mapAssetId) : current.assets,
    }));
    setView({ name: "track", trackId: layout.trackId });
    notify(`${layout.name} deleted`);
  }

  if (view.name === "library") {
    const filtered = data.tracks.filter((track) => `${track.name} ${track.location}`.toLowerCase().includes(search.toLowerCase()));
    return (
      <>
        <FeatureHeader title="Track Library" subtitle={`${data.tracks.length} ${data.tracks.length === 1 ? "track" : "tracks"}`} onBack={onBack} />
        <div className="page-content">
          <div className="section-heading"><div><p className="eyebrow">TRACK MAP NOTEBOOK</p><h1>Your circuits</h1></div><button className="button button-primary button-small" onClick={() => setEditor({ kind: "track" })}><Plus /> New</button></div>
          {data.tracks.length > 2 && <input className="input track-search" type="search" placeholder="Search tracks" value={search} onChange={(event) => setSearch(event.target.value)} />}
          {filtered.length ? (
            <div className="item-list">
              {filtered.map((track) => {
                const layouts = data.layouts.filter((layout) => layout.trackId === track.id);
                const markers = layouts.reduce((total, layout) => total + layout.markers.length, 0);
                return (
                  <button className="list-item" key={track.id} onClick={() => setView({ name: "track", trackId: track.id })}>
                    <span className="list-icon"><MapPinned /></span>
                    <span className="list-copy"><strong>{track.name}</strong><span>{track.location || "Location not set"} · {layouts.length} layouts · {markers} markers</span></span>
                    <ChevronRight />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyMapState
              title={search ? "No matching tracks" : "Build your first track map"}
              text={search ? "Try another search." : "Upload a circuit map, then place braking, turn-in, apex and exit notes directly on it."}
              action={!search && <div className="track-empty-actions"><button className="button button-primary" onClick={openTestTrack}><Plus /> Create PF International</button><button className="button button-secondary" onClick={() => setEditor({ kind: "track" })}>Create another track</button></div>}
            />
          )}
        </div>
        {editor?.kind === "track" && <TrackEditor track={editor.track} onClose={() => setEditor(null)} onSave={saveTrack} />}
      </>
    );
  }

  if (view.name === "track") {
    const track = data.tracks.find((candidate) => candidate.id === view.trackId);
    if (!track) return <MissingRecord onBack={() => setView({ name: "library" })} />;
    const layouts = data.layouts.filter((layout) => layout.trackId === track.id);
    return (
      <>
        <FeatureHeader
          title={track.name}
          subtitle={track.location || "Track details"}
          onBack={() => setView({ name: "library" })}
          actions={<><button className="icon-button" aria-label="Edit track" onClick={() => setEditor({ kind: "track", track })}><Pencil /></button><button className="icon-button" aria-label="Delete track" onClick={() => deleteTrack(track)}><Trash2 /></button></>}
        />
        <div className="page-content">
          {track.notes && <article className="summary-card track-note-card"><p className="eyebrow">TRACK NOTES</p><p>{track.notes}</p></article>}
          <div className="section-heading track-layout-heading"><h1>Layouts</h1><button className="button button-primary button-small" onClick={() => setEditor({ kind: "layout", trackId: track.id })}><Plus /> New</button></div>
          {layouts.length ? (
            <div className="item-list">
              {layouts.map((layout) => (
                <button className="list-item" key={layout.id} onClick={() => setView({ name: "workspace", layoutId: layout.id })}>
                  <span className="list-icon"><ImageIcon /></span>
                  <span className="list-copy"><strong>{layout.name}</strong><span>{layout.direction} · {layout.markers.length} markers · {layout.mapAssetId ? "Map ready" : "Needs map image"}</span></span>
                  <ChevronRight />
                </button>
              ))}
            </div>
          ) : <EmptyMapState title="No layouts" text="Add a full, short or alternative circuit layout." />}
        </div>
        {editor?.kind === "track" && <TrackEditor track={editor.track} onClose={() => setEditor(null)} onSave={saveTrack} />}
        {editor?.kind === "layout" && <LayoutEditor layout={editor.layout} onClose={() => setEditor(null)} onSave={saveLayout} />}
      </>
    );
  }

  const layout = data.layouts.find((candidate) => candidate.id === view.layoutId);
  const track = layout ? data.tracks.find((candidate) => candidate.id === layout.trackId) : undefined;
  if (!layout || !track) {
    return <MissingRecord onBack={mode === "session" ? onBack : () => setView({ name: "library" })} text={mode === "session" ? "This Event does not have an available saved Track Layout. Edit the Event and choose one first." : undefined} />;
  }

  return (
    <>
      <FeatureHeader
        title={layout.name}
        subtitle={mode === "session" && session ? `${session.sessionName} · ${track.name}` : track.name}
        onBack={mode === "session" ? onBack : () => setView({ name: "track", trackId: track.id })}
        actions={mode === "library" ? <><button className="icon-button" aria-label="Edit layout" onClick={() => setEditor({ kind: "layout", trackId: track.id, layout })}><Pencil /></button><button className="icon-button" aria-label="Delete layout" onClick={() => deleteLayout(layout)}><Trash2 /></button></> : undefined}
      />
      <MapWorkspace data={data} layout={layout} track={track} session={mode === "session" ? session : undefined} onChange={onChange} notify={notify} />
      {editor?.kind === "layout" && <LayoutEditor layout={editor.layout} onClose={() => setEditor(null)} onSave={saveLayout} />}
    </>
  );
}

function MissingRecord({ onBack, text = "This track or layout may have been deleted." }: { onBack: () => void; text?: string }) {
  return <><FeatureHeader title="Track maps" onBack={onBack} /><div className="page-content"><EmptyMapState title="Map unavailable" text={text} /></div></>;
}

function TrackEditor({ track, onClose, onSave }: { track?: Track; onClose: () => void; onSave: (value: { name: string; location: string; notes: string }) => void }) {
  const [form, setForm] = useState({ name: track?.name ?? "", location: track?.location ?? "", notes: track?.notes ?? "" });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim(), location: form.location.trim() });
  }
  return (
    <div className="modal-backdrop">
      <form className="modal-sheet modal-compact" onSubmit={submit}>
        <div className="modal-head"><div><p className="eyebrow">TRACK LIBRARY</p><h2>{track ? "Edit track" : "New track"}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X /></button></div>
        <div className="form-grid">
          <label className="field field-full"><span>Track name</span><input className="input" required autoFocus placeholder="e.g. PF International" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="field field-full"><span>Location</span><input className="input" placeholder="Town, country" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          <label className="field field-full"><span>General track notes</span><textarea className="textarea" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        </div>
        <button className="button button-primary button-block" type="submit"><Check /> {track ? "Save changes" : "Create track"}</button>
      </form>
    </div>
  );
}

function LayoutEditor({ layout, onClose, onSave }: { layout?: TrackLayout; onClose: () => void; onSave: (value: { name: string; direction: TrackLayout["direction"] }) => void }) {
  const [name, setName] = useState(layout?.name ?? "Full Layout");
  const [direction, setDirection] = useState<TrackLayout["direction"]>(layout?.direction ?? "Unknown");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) onSave({ name: name.trim(), direction });
  }
  return (
    <div className="modal-backdrop">
      <form className="modal-sheet modal-compact" onSubmit={submit}>
        <div className="modal-head"><div><p className="eyebrow">TRACK LAYOUT</p><h2>{layout ? "Edit layout" : "New layout"}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X /></button></div>
        <div className="form-grid">
          <label className="field field-full"><span>Layout name</span><input className="input" required autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field field-full"><span>Direction</span><select className="select" value={direction} onChange={(event) => setDirection(event.target.value as TrackLayout["direction"])}><option>Unknown</option><option>Clockwise</option><option>Anti-clockwise</option></select></label>
        </div>
        <button className="button button-primary button-block" type="submit"><Check /> {layout ? "Save changes" : "Create layout"}</button>
      </form>
    </div>
  );
}

function MapWorkspace({ data, layout, track, session, onChange, notify }: { data: TrackMapData; layout: TrackLayout; track: Track; session?: SessionContext; onChange: TrackMapFeatureProps["onChange"]; notify: (message: string) => void }) {
  const [zoom, setZoom] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [addType, setAddType] = useState<TrackMarkerType | null>(null);
  const [moveMarkerId, setMoveMarkerId] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const asset = data.assets.find((candidate) => candidate.id === layout.mapAssetId);
  const imageUrl = getAssetUrl(asset);
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
        layouts: current.layouts.map((candidate) => candidate.id === layout.id ? { ...candidate, mapAssetId: nextAsset.id, sourceAttribution: undefined, sourceUrl: undefined, updatedAt: now() } : candidate),
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

      {asset && imageUrl ? (
        <>
          <div className="map-controls">
            <button className="icon-button map-control-button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.25))}><Minus /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button className="icon-button map-control-button" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + 0.25))}><ZoomIn /></button>
            <button className="text-button map-reset" onClick={() => setZoom(1)}>Reset</button>
          </div>
          {editMode && (
            <div className="marker-add-bar">
              <span>{moveMarkerId ? "Tap the new marker position" : addType ? `Tap map to place ${addType}` : "Add marker:"}</span>
              {!moveMarkerId && <select className="select" value={addType ?? ""} onChange={(event) => setAddType((event.target.value || null) as TrackMarkerType | null)}><option value="">Choose type</option>{markerTypes.map((type) => <option key={type}>{type}</option>)}</select>}
              {(addType || moveMarkerId) && <button className="icon-button" aria-label="Cancel marker placement" onClick={() => { setAddType(null); setMoveMarkerId(null); }}><X /></button>}
            </div>
          )}
          <div className={`track-map-viewport ${addType || moveMarkerId ? "placing-marker" : ""}`}>
            <div className="track-map-stage" style={{ width: `${zoom * 100}%` }} onClick={mapClicked}>
              <Image className="track-map-image" src={imageUrl} alt={`${track.name} ${layout.name} map`} width={asset.width} height={asset.height} unoptimized draggable={false} />
              {layout.markers.map((marker) => (
                <button
                  className={`map-marker marker-${marker.type.toLowerCase().replace("-", "")} ${selectedMarkerId === marker.id ? "selected" : ""}`}
                  style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
                  key={marker.id}
                  aria-label={`${marker.type}: ${marker.label}`}
                  title={`${marker.type}: ${marker.label}`}
                  onClick={(event) => { event.stopPropagation(); setSelectedMarkerId(marker.id); }}
                ><span>{markerShortNames[marker.type]}</span><small>{marker.label}</small></button>
              ))}
            </div>
          </div>
          {!session && <div className="map-image-actions"><button className="text-button" onClick={() => fileRef.current?.click()}><Upload /> Replace map image</button><span>{Math.round(asset.size / 1024)} KB</span></div>}
          {layout.sourceAttribution && <p className="map-attribution">{layout.sourceAttribution}{layout.sourceUrl && <> · <a href={layout.sourceUrl} target="_blank" rel="noreferrer">View licence</a></>}</p>}
        </>
      ) : (
        <EmptyMapState title="Add the circuit map" text="Choose a clear overhead layout image. It will be resized and stored only on this device." action={!session && <button className="button button-primary" disabled={uploading} onClick={() => fileRef.current?.click()}><Upload /> {uploading ? "Preparing image…" : "Choose map image"}</button>} />
      )}
      <input className="visually-hidden" ref={fileRef} type="file" accept="image/*" onChange={uploadImage} />

      {selectedMarker ? (
        <section className="marker-panel">
          <div className="marker-panel-head"><div><span className={`marker-key marker-${selectedMarker.type.toLowerCase().replace("-", "")}`}>{markerShortNames[selectedMarker.type]}</span><div><p className="eyebrow">{selectedMarker.type}</p><h2>{selectedMarker.label || "Untitled marker"}</h2></div></div><button className="icon-button" aria-label="Close marker" onClick={() => setSelectedMarkerId(null)}><X /></button></div>
          {session ? (
            <div className="marker-session-content">
              {selectedMarker.shortInstruction && <p className="marker-instruction">{selectedMarker.shortInstruction}</p>}
              {selectedMarker.generalNote && <div className="reference-note"><strong>General reference</strong><p>{selectedMarker.generalNote}</p></div>}
              {conditionNote && <div className="reference-note"><strong>{session.condition} reference</strong><p>{conditionNote}</p></div>}
              <label className="field"><span>What happened in {session.sessionName}?</span><textarea className="textarea" placeholder="Grip, line, braking point, what to try next…" value={observation?.note ?? ""} onChange={(event) => updateObservation({ note: event.target.value })} /></label>
              <label className="field"><span>Result</span><select className="select" value={observation?.result ?? ""} onChange={(event) => updateObservation({ result: event.target.value as MarkerObservation["result"] })}><option value="">Not rated</option><option>Better</option><option>Same</option><option>Worse</option></select></label>
              <p className="auto-save-note"><Check /> Session observation saves automatically</p>
            </div>
          ) : editMode ? (
            <div className="form-grid marker-form">
              <label className="field"><span>Label</span><input className="input" value={selectedMarker.label} onChange={(event) => updateMarker({ label: event.target.value })} /></label>
              <label className="field"><span>Type</span><select className="select" value={selectedMarker.type} onChange={(event) => updateMarker({ type: event.target.value as TrackMarkerType })}>{markerTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label className="field field-full"><span>Short instruction</span><input className="input" placeholder="e.g. Brake at marshal post" value={selectedMarker.shortInstruction} onChange={(event) => updateMarker({ shortInstruction: event.target.value })} /></label>
              <label className="field field-full"><span>General note</span><textarea className="textarea" value={selectedMarker.generalNote} onChange={(event) => updateMarker({ generalNote: event.target.value })} /></label>
              <label className="field field-full"><span>Dry note</span><textarea className="textarea" value={selectedMarker.dryNote} onChange={(event) => updateMarker({ dryNote: event.target.value })} /></label>
              <label className="field field-full"><span>Wet note</span><textarea className="textarea" value={selectedMarker.wetNote} onChange={(event) => updateMarker({ wetNote: event.target.value })} /></label>
              <div className="marker-actions field-full"><button className="button button-secondary" onClick={() => { setMoveMarkerId(selectedMarker.id); setAddType(null); }}><Move /> Move</button><button className="button button-secondary danger-text" onClick={deleteMarker}><Trash2 /> Delete</button></div>
              <p className="auto-save-note field-full"><Check /> Reference marker saves automatically</p>
            </div>
          ) : (
            <div className="marker-reference-content">
              {selectedMarker.shortInstruction && <p className="marker-instruction">{selectedMarker.shortInstruction}</p>}
              {selectedMarker.generalNote && <div className="reference-note"><strong>General</strong><p>{selectedMarker.generalNote}</p></div>}
              {selectedMarker.dryNote && <div className="reference-note"><strong>Dry</strong><p>{selectedMarker.dryNote}</p></div>}
              {selectedMarker.wetNote && <div className="reference-note"><strong>Wet</strong><p>{selectedMarker.wetNote}</p></div>}
              {!selectedMarker.shortInstruction && !selectedMarker.generalNote && !selectedMarker.dryNote && !selectedMarker.wetNote && <p className="help-text">No notes on this marker yet. Switch to Edit map to add them.</p>}
            </div>
          )}
        </section>
      ) : layout.markers.length > 0 ? <p className="map-help"><Crosshair /> Tap a marker to read or edit its notes. Zoom in, then drag the map area to pan.</p> : asset ? <p className="map-help"><BookOpen /> Switch to Edit map, choose a marker type, then tap its position on the circuit.</p> : null}

      {session && (
        <section className="settings-section session-map-summary">
          <label className="field"><span>Overall Session track summary</span><textarea className="textarea" placeholder="Overall grip, changing conditions, key lesson…" value={visit?.summary ?? ""} onChange={(event) => updateSummary(event.target.value)} /></label>
          <p className="auto-save-note"><Check /> Saved separately from permanent Track notes</p>
        </section>
      )}
    </div>
  );
}
