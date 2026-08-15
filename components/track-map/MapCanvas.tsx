"use client";

import { Minus, ZoomIn } from "lucide-react";
import { MouseEvent } from "react";
import type { MapAsset, TrackMarker } from "@/lib/track-map/types";
import { MapImage, markerClass, markerShortNames } from "./shared";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

type MapCanvasProps = {
  asset: MapAsset;
  alt: string;
  markers: TrackMarker[];
  selectedMarkerId: string | null;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  placing: boolean;
  onMapClick: (event: MouseEvent<HTMLDivElement>) => void;
  onSelectMarker: (markerId: string) => void;
};

export function MapCanvas({
  asset,
  alt,
  markers,
  selectedMarkerId,
  zoom,
  onZoomChange,
  placing,
  onMapClick,
  onSelectMarker,
}: MapCanvasProps) {
  return (
    <>
      <div className="map-controls">
        <button className="icon-button map-control-button" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}><Minus /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button className="icon-button map-control-button" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}><ZoomIn /></button>
        <button className="text-button map-reset" onClick={() => onZoomChange(MIN_ZOOM)}>Reset</button>
      </div>
      <div className={`track-map-viewport ${placing ? "placing-marker" : ""}`}>
        <div className="track-map-stage" style={{ width: `${zoom * 100}%` }} onClick={onMapClick}>
          <MapImage className="track-map-image" asset={asset} alt={alt} />
          {markers.map((marker) => (
            <button
              className={`map-marker ${markerClass(marker.type)} ${selectedMarkerId === marker.id ? "selected" : ""}`}
              style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
              key={marker.id}
              aria-label={`${marker.type}: ${marker.label}`}
              title={`${marker.type}: ${marker.label}`}
              onClick={(event) => { event.stopPropagation(); onSelectMarker(marker.id); }}
            ><span>{markerShortNames[marker.type]}</span><small>{marker.label}</small></button>
          ))}
        </div>
      </div>
    </>
  );
}
