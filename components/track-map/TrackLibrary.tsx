"use client";

import { ChevronRight, ImageIcon, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import type { Track, TrackLayout, TrackMapData } from "@/lib/track-map/types";
import { EmptyMapState, FeatureHeader } from "./shared";

type TrackLibraryViewProps = {
  data: TrackMapData;
  search: string;
  onSearchChange: (value: string) => void;
  onBack: () => void;
  onOpenTrack: (trackId: string) => void;
  onNewTrack: () => void;
  onCreateTestTrack: () => void;
};

export function TrackLibraryView({ data, search, onSearchChange, onBack, onOpenTrack, onNewTrack, onCreateTestTrack }: TrackLibraryViewProps) {
  const filtered = data.tracks.filter((track) => `${track.name} ${track.location}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <FeatureHeader title="Track Library" subtitle={`${data.tracks.length} ${data.tracks.length === 1 ? "track" : "tracks"}`} onBack={onBack} />
      <div className="page-content">
        <div className="section-heading">
          <div><p className="eyebrow">TRACK MAP NOTEBOOK</p><h1>Your circuits</h1></div>
          <button className="button button-primary button-small" onClick={onNewTrack}><Plus /> New</button>
        </div>
        {data.tracks.length > 2 && <input className="input track-search" type="search" placeholder="Search tracks" value={search} onChange={(event) => onSearchChange(event.target.value)} />}
        {filtered.length ? (
          <div className="item-list">
            {filtered.map((track) => {
              const layouts = data.layouts.filter((layout) => layout.trackId === track.id);
              const markers = layouts.reduce((total, layout) => total + layout.markers.length, 0);
              return (
                <button className="list-item" key={track.id} onClick={() => onOpenTrack(track.id)}>
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
            action={!search && (
              <div className="track-empty-actions">
                <button className="button button-primary" onClick={onCreateTestTrack}><Plus /> Create PF International</button>
                <button className="button button-secondary" onClick={onNewTrack}>Create another track</button>
              </div>
            )}
          />
        )}
      </div>
    </>
  );
}

type TrackDetailViewProps = {
  track: Track;
  layouts: TrackLayout[];
  onBack: () => void;
  onEditTrack: () => void;
  onDeleteTrack: () => void;
  onNewLayout: () => void;
  onOpenLayout: (layoutId: string) => void;
};

export function TrackDetailView({ track, layouts, onBack, onEditTrack, onDeleteTrack, onNewLayout, onOpenLayout }: TrackDetailViewProps) {
  return (
    <>
      <FeatureHeader
        title={track.name}
        subtitle={track.location || "Track details"}
        onBack={onBack}
        actions={(
          <>
            <button className="icon-button" aria-label="Edit track" onClick={onEditTrack}><Pencil /></button>
            <button className="icon-button" aria-label="Delete track" onClick={onDeleteTrack}><Trash2 /></button>
          </>
        )}
      />
      <div className="page-content">
        {track.notes && <article className="summary-card track-note-card"><p className="eyebrow">TRACK NOTES</p><p>{track.notes}</p></article>}
        <div className="section-heading track-layout-heading">
          <h1>Layouts</h1>
          <button className="button button-primary button-small" onClick={onNewLayout}><Plus /> New</button>
        </div>
        {layouts.length ? (
          <div className="item-list">
            {layouts.map((layout) => (
              <button className="list-item" key={layout.id} onClick={() => onOpenLayout(layout.id)}>
                <span className="list-icon"><ImageIcon /></span>
                <span className="list-copy"><strong>{layout.name}</strong><span>{layout.direction} · {layout.markers.length} markers · {layout.mapAssetId ? "Map ready" : "Needs map image"}</span></span>
                <ChevronRight />
              </button>
            ))}
          </div>
        ) : <EmptyMapState title="No layouts" text="Add a full, short or alternative circuit layout." />}
      </div>
    </>
  );
}
