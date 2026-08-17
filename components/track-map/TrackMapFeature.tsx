"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { MapAsset, Track, TrackLayout, TrackMapData } from "@/lib/track-map/types";
import { builtInPfiLayoutFields, loadBuiltInMapAsset } from "@/lib/track-map/built-in-map";
import { LayoutEditor, TrackEditor } from "./editors";
import { MapWorkspace } from "./MapWorkspace";
import { TrackDetailView, TrackLibraryView } from "./TrackLibrary";
import { ConfirmDeleteDialog, FeatureHeader, MissingRecord, now, SessionContext, TrackMapChange, useModalViewport } from "./shared";
import { useTranslation } from "@/lib/i18n";

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

type PendingDelete =
  | { kind: "track"; track: Track }
  | { kind: "layout"; layout: TrackLayout }
  | null;

export function TrackMapFeature({ data, mode, session, onChange, onBack, notify }: TrackMapFeatureProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<LibraryView>(() => mode === "session" && session?.layoutId
    ? { name: "workspace", layoutId: session.layoutId }
    : { name: "library" });
  const [editor, setEditor] = useState<EditorState>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [search, setSearch] = useState("");
  useModalViewport(Boolean(editor));

  function deleteDialog() {
    if (!pendingDelete) return null;
    if (pendingDelete.kind === "track") {
      const layouts = data.layouts.filter((layout) => layout.trackId === pendingDelete.track.id);
      const markers = layouts.reduce((total, layout) => total + layout.markers.length, 0);
      return (
        <ConfirmDeleteDialog
          title={`Delete ${pendingDelete.track.name}?`}
          detail={`This also deletes ${layouts.length} layout${layouts.length === 1 ? "" : "s"}, ${markers} marker${markers === 1 ? "" : "s"}, their map images and every Session observation recorded on them.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => deleteTrack(pendingDelete.track)}
        />
      );
    }
    const visits = data.visits.filter((visit) => visit.layoutId === pendingDelete.layout.id).length;
    return (
      <ConfirmDeleteDialog
        title={`Delete ${pendingDelete.layout.name}?`}
        detail={`This also deletes its map image, ${pendingDelete.layout.markers.length} marker${pendingDelete.layout.markers.length === 1 ? "" : "s"} and ${visits} Session overlay${visits === 1 ? "" : "s"}.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => deleteLayout(pendingDelete.layout)}
      />
    );
  }

  const openTestTrack = async () => {
    const timestamp = now();
    const trackId = crypto.randomUUID();
    const layoutId = crypto.randomUUID();
    let defaultAsset: MapAsset | undefined;
    try {
      defaultAsset = await loadBuiltInMapAsset();
    } catch {
      // The track can still be created if a static asset is unavailable; the user can upload a map later.
    }
    onChange((current) => ({
      ...current,
      tracks: [...current.tracks, { id: trackId, name: "PF International", location: "Grantham, UK", notes: "", createdAt: timestamp, updatedAt: timestamp }],
      layouts: [...current.layouts, {
        id: layoutId,
        trackId,
        name: "Full Layout",
        direction: "Unknown",
        mapAssetId: null,
        ...(defaultAsset ? builtInPfiLayoutFields(defaultAsset) : {}),
        markers: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      assets: defaultAsset ? [...current.assets, defaultAsset] : current.assets,
    }));
    setView({ name: "workspace", layoutId });
    notify(defaultAsset ? t("PF International created with a built-in map") : t("PF International created — upload your map image next"));
  };

  function saveTrack(input: { name: string; location: string; notes: string }) {
    const timestamp = now();
    if (editor?.kind === "track" && editor.track) {
      onChange((current) => ({
        ...current,
        tracks: current.tracks.map((track) => track.id === editor.track?.id ? { ...track, ...input, updatedAt: timestamp } : track),
      }));
      notify(t("Track updated"));
    } else {
      const trackId = crypto.randomUUID();
      const layoutId = crypto.randomUUID();
      onChange((current) => ({
        ...current,
        tracks: [...current.tracks, { ...input, id: trackId, createdAt: timestamp, updatedAt: timestamp }],
        layouts: [...current.layouts, { id: layoutId, trackId, name: "Full Layout", direction: "Unknown", mapAssetId: null, markers: [], createdAt: timestamp, updatedAt: timestamp }],
      }));
      setView({ name: "track", trackId });
      notify(t("Track created"));
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
      notify(t("Layout updated"));
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
      notify(t("Layout created"));
    }
    setEditor(null);
  }

  function deleteTrack(track: Track) {
    setPendingDelete(null);
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
    notify(t("{name} deleted", { name: track.name }));
  }

  function deleteLayout(layout: TrackLayout) {
    setPendingDelete(null);
    onChange((current) => ({
      ...current,
      layouts: current.layouts.filter((candidate) => candidate.id !== layout.id),
      visits: current.visits.filter((visit) => visit.layoutId !== layout.id),
      assets: layout.mapAssetId ? current.assets.filter((asset) => asset.id !== layout.mapAssetId) : current.assets,
    }));
    setView({ name: "track", trackId: layout.trackId });
    notify(t("{name} deleted", { name: layout.name }));
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
          onDeleteTrack={() => setPendingDelete({ kind: "track", track })}
          onNewLayout={() => setEditor({ kind: "layout", trackId: track.id })}
          onOpenLayout={(layoutId) => setView({ name: "workspace", layoutId })}
        />
        {editor?.kind === "track" && <TrackEditor track={editor.track} onClose={() => setEditor(null)} onSave={saveTrack} />}
        {editor?.kind === "layout" && <LayoutEditor layout={editor.layout} onClose={() => setEditor(null)} onSave={saveLayout} />}
        {deleteDialog()}
      </>
    );
  }

  const layout = data.layouts.find((candidate) => candidate.id === view.layoutId);
  const track = layout ? data.tracks.find((candidate) => candidate.id === layout.trackId) : undefined;
  if (!layout || !track) {
    return <MissingRecord onBack={mode === "session" ? onBack : () => setView({ name: "library" })} text={mode === "session" ? t("This Event does not have an available saved Track Layout. Edit the Event and choose one first.") : undefined} />;
  }

  return (
    <>
      <FeatureHeader
        title={layout.name}
        subtitle={mode === "session" && session ? `${session.sessionName} · ${track.name}` : track.name}
        onBack={mode === "session" ? onBack : () => setView({ name: "track", trackId: track.id })}
        actions={mode === "library" ? (
          <>
            <button className="icon-button" aria-label={t("Edit layout")} onClick={() => setEditor({ kind: "layout", trackId: track.id, layout })}><Pencil /></button>
            <button className="icon-button" aria-label={t("Delete layout")} onClick={() => setPendingDelete({ kind: "layout", layout })}><Trash2 /></button>
          </>
        ) : undefined}
      />
      <MapWorkspace data={data} layout={layout} track={track} session={mode === "session" ? session : undefined} onChange={onChange} notify={notify} />
      {editor?.kind === "layout" && <LayoutEditor layout={editor.layout} onClose={() => setEditor(null)} onSave={saveLayout} />}
      {deleteDialog()}
    </>
  );
}
