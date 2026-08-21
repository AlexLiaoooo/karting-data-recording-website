"use client";

import { Check, ChevronRight, Download, ImageIcon, MapPinned, Pencil, Plus, Trash2, X } from "lucide-react";
import { counted } from "@/lib/format";
import type { BuiltInTrack } from "@/lib/track-map/built-in-maps";
import type { Track, TrackLayout, TrackMapData } from "@/lib/track-map/types";
import { EmptyMapState, FeatureHeader, useModalViewport } from "./shared";
import { useTranslation } from "@/lib/i18n";

type TrackLibraryViewProps = {
  data: TrackMapData;
  search: string;
  onSearchChange: (value: string) => void;
  onBack: () => void;
  onOpenTrack: (trackId: string) => void;
  onNewTrack: () => void;
  onOpenBuiltIns: () => void;
};

export function TrackLibraryView({ data, search, onSearchChange, onBack, onOpenTrack, onNewTrack, onOpenBuiltIns }: TrackLibraryViewProps) {
  const { t } = useTranslation();
  const filtered = data.tracks.filter((track) => `${track.name} ${track.location}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <FeatureHeader title={t("Track Library")} subtitle={counted(data.tracks.length, "track")} onBack={onBack} />
      <div className="page-content">
        <div className="section-heading">
          <div><p className="eyebrow">{t("TRACK MAP NOTEBOOK")}</p><h1>{t("Your circuits")}</h1></div>
          <div className="section-heading-actions">
            <button className="button button-secondary button-small" onClick={onOpenBuiltIns}><Download /> {t("Built-in")}</button>
            <button className="button button-primary button-small" onClick={onNewTrack}><Plus /> {t("New")}</button>
          </div>
        </div>
        {data.tracks.length > 2 && <input className="input track-search" type="search" placeholder={t("Search tracks")} value={search} onChange={(event) => onSearchChange(event.target.value)} />}
        {filtered.length ? (
          <div className="item-list">
            {filtered.map((track) => {
              const layouts = data.layouts.filter((layout) => layout.trackId === track.id);
              const markers = layouts.reduce((total, layout) => total + layout.markers.length, 0);
              return (
                <button className="list-item" key={track.id} onClick={() => onOpenTrack(track.id)}>
                  <span className="list-icon"><MapPinned /></span>
                  <span className="list-copy"><strong>{track.name}</strong><span>{track.location || t("Location not set")} · {counted(layouts.length, "layout")} · {counted(markers, "marker")}</span></span>
                  <ChevronRight />
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyMapState
            title={search ? "No matching tracks" : t("Build your first track map")}
            text={search ? t("Try another search.") : t("Upload a circuit map, then place braking, turn-in, apex and exit notes directly on it.")}
            action={!search && (
              <div className="track-empty-actions">
                <button className="button button-primary" onClick={onOpenBuiltIns}><Download /> {t("Add a built-in circuit")}</button>
                <button className="button button-secondary" onClick={onNewTrack}>{t("Create another track")}</button>
              </div>
            )}
          />
        )}
      </div>
    </>
  );
}

type BuiltInTrackPickerProps = {
  tracks: BuiltInTrack[];
  existing: Track[];
  onClose: () => void;
  onPick: (track: BuiltInTrack) => void;
};

/**
 * Offers the circuits that ship with the app.
 *
 * A circuit already in the library is shown as added rather than hidden, so the list does not
 * change shape between visits, and is not offered again — adding it twice would leave two tracks
 * of the same name with separate markers, which is never what someone means by tapping it again.
 */
export function BuiltInTrackPicker({ tracks, existing, onClose, onPick }: BuiltInTrackPickerProps) {
  const { t } = useTranslation();
  useModalViewport(true);
  const names = new Set(existing.map((track) => track.name.trim().toLowerCase()));

  return (
    <div className="modal-backdrop">
      <section className="modal-sheet modal-compact" role="dialog" aria-modal="true" aria-labelledby="built-in-track-title">
        <div className="modal-head">
          <div><p className="eyebrow">{t("TRACK LIBRARY")}</p><h2 id="built-in-track-title">{t("Built-in circuits")}</h2></div>
          <button className="icon-button" type="button" aria-label={t("Close")} onClick={onClose}><X /></button>
        </div>
        <div className="item-list built-in-list">
          {tracks.map((track) => {
            const added = names.has(track.name.trim().toLowerCase());
            const layouts = track.layouts.map((layout) => layout.name).join(" · ");
            return (
              <button className="list-item" key={track.key} disabled={added} onClick={() => onPick(track)}>
                <span className="list-icon">{added ? <Check /> : <MapPinned />}</span>
                <span className="list-copy">
                  <strong>{track.name}</strong>
                  <span>{track.location} · {layouts}</span>
                </span>
                {added ? <span className="list-note">{t("Added")}</span> : <ChevronRight />}
              </button>
            );
          })}
        </div>
        <p className="modal-footnote">{t("Maps are drawn from OpenStreetMap geometry. You can replace any of them with your own image later.")}</p>
      </section>
    </div>
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
  const { t } = useTranslation();
  return (
    <>
      <FeatureHeader
        title={track.name}
        subtitle={track.location || t("Track details")}
        onBack={onBack}
        actions={(
          <>
            <button className="icon-button" aria-label={t("Edit track")} onClick={onEditTrack}><Pencil /></button>
            <button className="icon-button" aria-label={t("Delete track")} onClick={onDeleteTrack}><Trash2 /></button>
          </>
        )}
      />
      <div className="page-content">
        {track.notes && <article className="summary-card track-note-card"><p className="eyebrow">{t("TRACK NOTES")}</p><p>{track.notes}</p></article>}
        <div className="section-heading track-layout-heading">
          <h1>{t("Layouts")}</h1>
          <button className="button button-primary button-small" onClick={onNewLayout}><Plus /> {t("New")}</button>
        </div>
        {layouts.length ? (
          <div className="item-list">
            {layouts.map((layout) => (
              <button className="list-item" key={layout.id} onClick={() => onOpenLayout(layout.id)}>
                <span className="list-icon"><ImageIcon /></span>
                <span className="list-copy"><strong>{layout.name}</strong><span>{t(layout.direction)} · {counted(layout.markers.length, "marker")} · {layout.mapAssetId ? t("Map ready") : t("Needs map image")}</span></span>
                <ChevronRight />
              </button>
            ))}
          </div>
        ) : <EmptyMapState title={t("No layouts")} text={t("Add a full, short or alternative circuit layout.")} />}
      </div>
    </>
  );
}
