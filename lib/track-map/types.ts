export type TrackMarkerType =
  | "Corner"
  | "Braking"
  | "Turn-in"
  | "Apex"
  | "Exit"
  | "Hazard"
  | "Overtaking"
  | "Focus";

/**
 * A named corner on a layout, in lap order. Positions are normalised to the map asset box,
 * the same convention as TrackMarker, so both survive the image being displayed at any size.
 */
export type TrackCorner = {
  number: number;
  label: string;
  x: number;
  y: number;
};

export type Track = {
  id: string;
  name: string;
  location: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type TrackMarker = {
  id: string;
  x: number;
  y: number;
  order: number;
  label: string;
  type: TrackMarkerType;
  shortInstruction: string;
  generalNote: string;
  dryNote: string;
  wetNote: string;
  tags: string[];
  updatedAt: string;
};

export type TrackLayout = {
  id: string;
  trackId: string;
  name: string;
  direction: "Clockwise" | "Anti-clockwise" | "Unknown";
  mapAssetId: string | null;
  sourceAttribution?: string;
  sourceUrl?: string;
  /** Set only while the layout carries an app-supplied map; see lib/track-map/built-in-map.ts. */
  builtInMapVersion?: string;
  /** Lap-ordered corners used for labelling the map and placing markers by corner. */
  corners?: TrackCorner[];
  markers: TrackMarker[];
  createdAt: string;
  updatedAt: string;
};

export type MarkerObservation = {
  id: string;
  markerId: string;
  sessionId: string;
  note: string;
  result: "" | "Better" | "Same" | "Worse";
  createdAt: string;
  updatedAt: string;
};

export type TrackVisit = {
  id: string;
  layoutId: string;
  eventId: string;
  sessionId: string;
  date: string;
  condition: "Dry" | "Damp" | "Wet" | "Mixed";
  observations: MarkerObservation[];
  summary: string;
  createdAt: string;
  updatedAt: string;
};

export type MapAsset = {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
  size: number;
  updatedAt: string;
};

export type TrackMapData = {
  version: 1;
  tracks: Track[];
  layouts: TrackLayout[];
  visits: TrackVisit[];
  assets: MapAsset[];
};

export const markerTypes: TrackMarkerType[] = [
  "Corner",
  "Braking",
  "Turn-in",
  "Apex",
  "Exit",
  "Hazard",
  "Overtaking",
  "Focus",
];

export const emptyTrackMapData = (): TrackMapData => ({
  version: 1,
  tracks: [],
  layouts: [],
  visits: [],
  assets: [],
});
