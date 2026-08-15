"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { MapAsset, Track, TrackLayout, TrackMapData } from "@/lib/track-map/types";
import { LayoutEditor, TrackEditor } from "./editors";
import { MapWorkspace } from "./MapWorkspace";
import { TrackDetailView, TrackLibraryView } from "./TrackLibrary";
import { FeatureHeader, MissingRecord, now, SessionContext, TrackMapChange, useModalViewport } from "./shared";

export type { SessionContext } from "./shared";

type TrackMapFeatureProps = {
  data: TrackMapData;
  mode: "library" | "session";
  session?: SessionContext;
  onChange: TrackMapChange;
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
    return (
      <>
        <TrackLibraryView
          data={data}
          search={search}
          onSearchChange={setSearch}
          onBack={onBack}
          onOpenTrack={(trackId) => setView({ name: "track", trackId })}
          onNewTrack={() => setEditor({ kind: "track" })}
          onCreateTestTrack={openTestTrack}
        />
        {editor?.kind === "track" && <TrackEditor track={editor.track} onClose={() => setEditor(null)} onSave={saveTrack} />}
      </>
    );
  }

  if (view.name === "track") {
    const track = data.tracks.find((candidate) => candidate.id === view.trackId);
    if (!track) return <MissingRecord onBack={() => setView({ name: "library" })} />;
    return (
      <>
        <TrackDetailView
          track={track}
          layouts={data.layouts.filter((layout) => layout.trackId === track.id)}
          onBack={() => setView({ name: "library" })}
          onEditTrack={() => setEditor({ kind: "track", track })}
          onDeleteTrack={() => deleteTrack(track)}
          onNewLayout={() => setEditor({ kind: "layout", trackId: track.id })}
          onOpenLayout={(layoutId) => setView({ name: "workspace", layoutId })}
        />
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
        actions={mode === "library" ? (
          <>
            <button className="icon-button" aria-label="Edit layout" onClick={() => setEditor({ kind: "layout", trackId: track.id, layout })}><Pencil /></button>
            <button className="icon-button" aria-label="Delete layout" onClick={() => deleteLayout(layout)}><Trash2 /></button>
          </>
        ) : undefined}
      />
      <MapWorkspace data={data} layout={layout} track={track} session={mode === "session" ? session : undefined} onChange={onChange} notify={notify} />
      {editor?.kind === "layout" && <LayoutEditor layout={editor.layout} onClose={() => setEditor(null)} onSave={saveLayout} />}
    </>
  );
}
